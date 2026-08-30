'use strict';

const PLAYER_SIZE = { width: 34, height: 46 };
const DEFAULTS = Object.freeze({
  moveSpeed: 270,
  groundAcceleration: 2600,
  groundDeceleration: 3200,
  airAcceleration: 1600,
  airDeceleration: 700,
  jumpSpeed: 640,
  doubleJumpSpeed: 590,
  gravity: 1450,
  jumpCutGravityMultiplier: 2.35,
  maxFallSpeed: 900,
  coyoteTime: 0.11,
  jumpBuffer: 0.12,
  maxAirJumps: 1,
  speedBoostMultiplier: 1.35,
  jumpBoostMultiplier: 1.18,
  magnetRadius: 145,
  shieldInvulnerability: 1.05
});

function overlaps(a, b) {
  return a.x < b.x + b.width && a.x + a.width > b.x && a.y < b.y + b.height && a.y + a.height > b.y;
}

function approach(current, target, maxDelta) {
  if (current < target) return Math.min(target, current + maxDelta);
  if (current > target) return Math.max(target, current - maxDelta);
  return target;
}

function centerDistance(a, b) {
  const ax = a.x + a.width / 2;
  const ay = a.y + a.height / 2;
  const bx = b.x + b.width / 2;
  const by = b.y + b.height / 2;
  return Math.hypot(ax - bx, ay - by);
}

function createPlayer(spawn) {
  return {
    x: spawn.x,
    y: spawn.y,
    width: PLAYER_SIZE.width,
    height: PLAYER_SIZE.height,
    vx: 0,
    vy: 0,
    grounded: false,
    coyote: 0,
    jumpBuffer: 0,
    airJumpsRemaining: DEFAULTS.maxAirJumps,
    checkpoint: { x: spawn.x, y: spawn.y, id: 'start' },
    collected: [],
    collectedPowerups: [],
    power: {
      speedTimer: 0,
      jumpTimer: 0,
      magnetTimer: 0,
      shieldCharges: 0,
      invulnerableTimer: 0
    },
    deaths: 0,
    finished: false,
    finishBlocked: false,
    missingPickups: 0,
    state: 'idle'
  };
}

function solidCollisionX(player, platform) {
  if (!overlaps(player, platform)) return;
  if (player.vx > 0) player.x = platform.x - player.width;
  else if (player.vx < 0) player.x = platform.x + platform.width;
  player.vx = 0;
}

function solidCollisionY(player, platform, config) {
  if (!overlaps(player, platform)) return;
  if (player.vy > 0) {
    player.y = platform.y - player.height;
    player.vy = 0;
    player.grounded = true;
    player.airJumpsRemaining = config.maxAirJumps;
  } else if (player.vy < 0) {
    player.y = platform.y + platform.height;
    player.vy = 0;
  }
}

function respawn(player, config) {
  player.x = player.checkpoint.x;
  player.y = player.checkpoint.y;
  player.vx = 0;
  player.vy = 0;
  player.grounded = false;
  player.coyote = 0;
  player.jumpBuffer = 0;
  player.airJumpsRemaining = config.maxAirJumps;
  player.power.invulnerableTimer = 0.45;
  player.deaths += 1;
  player.finishBlocked = false;
  player.state = 'hurt';
}

function pickupRequirement(level) {
  const explicit = Number(level?.requiredPickups);
  if (Number.isInteger(explicit) && explicit >= 0) return explicit;
  return Array.isArray(level?.pickups) ? level.pickups.length : 0;
}

function tickPowerTimers(player, step) {
  player.power.speedTimer = Math.max(0, player.power.speedTimer - step);
  player.power.jumpTimer = Math.max(0, player.power.jumpTimer - step);
  player.power.magnetTimer = Math.max(0, player.power.magnetTimer - step);
  player.power.invulnerableTimer = Math.max(0, player.power.invulnerableTimer - step);
}

function collectPowerup(player, powerup) {
  if (player.collectedPowerups.includes(powerup.id)) return;
  player.collectedPowerups.push(powerup.id);
  if (powerup.type === 'speed') player.power.speedTimer = Math.max(player.power.speedTimer, Number(powerup.duration) || 8);
  else if (powerup.type === 'jump') player.power.jumpTimer = Math.max(player.power.jumpTimer, Number(powerup.duration) || 10);
  else if (powerup.type === 'magnet') player.power.magnetTimer = Math.max(player.power.magnetTimer, Number(powerup.duration) || 10);
  else if (powerup.type === 'shield') player.power.shieldCharges = Math.min(2, player.power.shieldCharges + 1);
}

function checkpointsFor(level) {
  if (Array.isArray(level?.checkpoints)) return level.checkpoints;
  return level?.checkpoint ? [level.checkpoint] : [];
}

function stepPlayer(inputPlayer, input, level, dt, config = DEFAULTS) {
  const player = JSON.parse(JSON.stringify(inputPlayer));
  if (player.finished) return player;
  if (!player.power) {
    player.power = { speedTimer: 0, jumpTimer: 0, magnetTimer: 0, shieldCharges: 0, invulnerableTimer: 0 };
  }
  if (!Array.isArray(player.collectedPowerups)) player.collectedPowerups = [];
  if (!Number.isInteger(player.airJumpsRemaining)) player.airJumpsRemaining = config.maxAirJumps;

  const step = Math.min(Math.max(dt, 0), 1 / 20);
  const requiredPickups = pickupRequirement(level);
  tickPowerTimers(player, step);
  player.finishBlocked = false;
  player.missingPickups = Math.max(0, requiredPickups - player.collected.length);

  player.jumpBuffer = input.jumpPressed ? config.jumpBuffer : Math.max(0, player.jumpBuffer - step);
  player.coyote = player.grounded ? config.coyoteTime : Math.max(0, player.coyote - step);

  const speedMultiplier = player.power.speedTimer > 0 ? config.speedBoostMultiplier : 1;
  const jumpMultiplier = player.power.jumpTimer > 0 ? config.jumpBoostMultiplier : 1;
  const direction = (input.right ? 1 : 0) - (input.left ? 1 : 0);
  const targetVx = direction * config.moveSpeed * speedMultiplier;
  const acceleration = player.grounded ? config.groundAcceleration : config.airAcceleration;
  const deceleration = player.grounded ? config.groundDeceleration : config.airDeceleration;
  player.vx = approach(player.vx, targetVx, (direction === 0 ? deceleration : acceleration) * step);

  let jumped = false;
  if (player.jumpBuffer > 0 && player.coyote > 0) {
    player.vy = -config.jumpSpeed * jumpMultiplier;
    player.grounded = false;
    player.coyote = 0;
    player.jumpBuffer = 0;
    jumped = true;
  } else if (input.jumpPressed && player.airJumpsRemaining > 0) {
    player.vy = -config.doubleJumpSpeed * jumpMultiplier;
    player.grounded = false;
    player.coyote = 0;
    player.jumpBuffer = 0;
    player.airJumpsRemaining -= 1;
    jumped = true;
  }

  if (jumped) player.state = player.airJumpsRemaining < config.maxAirJumps ? 'double-jump' : 'jump';

  player.x += player.vx * step;
  player.x = Math.max(0, Math.min(Math.max(0, level.worldWidth - player.width), player.x));
  for (const platform of level.platforms) solidCollisionX(player, platform);

  player.grounded = false;
  const jumpCut = !jumped && input.jumpHeld === false && player.vy < 0;
  const gravityMultiplier = jumpCut ? config.jumpCutGravityMultiplier : 1;
  player.vy = Math.min(config.maxFallSpeed, player.vy + config.gravity * gravityMultiplier * step);
  player.y += player.vy * step;
  for (const platform of level.platforms) solidCollisionY(player, platform, config);

  for (const powerup of level.powerups || []) {
    if (!player.collectedPowerups.includes(powerup.id) && overlaps(player, powerup)) collectPowerup(player, powerup);
  }

  for (const pickup of level.pickups) {
    const magnetCollect = player.power.magnetTimer > 0 && centerDistance(player, pickup) <= config.magnetRadius;
    if (!player.collected.includes(pickup.id) && (overlaps(player, pickup) || magnetCollect)) player.collected.push(pickup.id);
  }
  player.missingPickups = Math.max(0, requiredPickups - player.collected.length);

  for (const checkpoint of checkpointsFor(level)) {
    if (overlaps(player, checkpoint)) {
      player.checkpoint = {
        x: checkpoint.respawnX,
        y: checkpoint.respawnY,
        id: checkpoint.id || `${checkpoint.respawnX}:${checkpoint.respawnY}`
      };
    }
  }

  const hitHazard = level.hazards.some((hazard) => overlaps(player, hazard)) || player.y > level.worldHeight + 160;
  if (hitHazard && player.power.invulnerableTimer <= 0) {
    if (player.power.shieldCharges > 0 && player.y <= level.worldHeight + 160) {
      player.power.shieldCharges -= 1;
      player.power.invulnerableTimer = config.shieldInvulnerability;
      player.vy = -Math.min(470, config.jumpSpeed * 0.74);
      player.state = 'shield-bounce';
    } else {
      respawn(player, config);
      return player;
    }
  }

  if (level.finish && player.x + player.width >= level.finish.x) {
    if (player.missingPickups > 0) {
      player.x = Math.min(player.x, level.finish.x - player.width);
      player.vx = 0;
      player.finishBlocked = true;
      player.state = 'finish-blocked';
      return player;
    }
    player.finished = true;
    player.finishBlocked = false;
    player.vx = 0;
    player.vy = 0;
    player.state = 'finish';
    return player;
  }

  if (!player.grounded && !['double-jump', 'shield-bounce'].includes(player.state)) player.state = player.vy < 0 ? 'jump' : 'fall';
  else if (player.grounded && Math.abs(player.vx) > 1) player.state = 'run';
  else if (player.grounded) player.state = 'idle';
  return player;
}

const BEST_KEY = 'dtf-seed-man-best-v1';
const CAMERA_FOLLOW_RATE = 7.7;
const CAMERA_LOOK_AHEAD_SECONDS = 0.18;
const canvas = document.querySelector('#game');
const ctx = canvas?.getContext('2d');
const ui = {
  load: document.querySelector('#load-status'),
  sprouts: document.querySelector('#sprout-count'),
  deaths: document.querySelector('#death-count'),
  time: document.querySelector('#time-count'),
  best: document.querySelector('#best-count'),
  power: document.querySelector('#power-count'),
  jump: document.querySelector('#jump-count'),
  progress: document.querySelector('#progress-count'),
  restart: document.querySelector('#restart'),
  pause: document.querySelector('#pause'),
  finish: document.querySelector('#finish-panel'),
  summary: document.querySelector('#finish-summary'),
  again: document.querySelector('#play-again')
};

let level;
let player;
let elapsed = 0;
let accumulator = 0;
let previous = 0;
let cameraX = 0;
let running = false;
let paused = false;
let powerNotice = null;
let lastPowerupCount = 0;
const STEP = 1 / 60;
const input = { left: false, right: false, jumpHeld: false, jumpQueued: false };

function readBest() {
  try {
    const value = Number.parseFloat(window.localStorage.getItem(BEST_KEY) || '');
    return Number.isFinite(value) && value > 0 ? value : null;
  } catch (error) {
    console.warn('Seed Man personal best storage is unavailable.', error);
    return null;
  }
}

function writeBest(value) {
  try {
    window.localStorage.setItem(BEST_KEY, String(value));
  } catch (error) {
    console.warn('Seed Man personal best could not be saved.', error);
  }
}

function focusCanvas() {
  if (!canvas) return;
  try {
    canvas.focus({ preventScroll: true });
  } catch {
    canvas.focus();
  }
}

function requiredSprouts() {
  const explicit = Number(level?.requiredPickups);
  if (Number.isInteger(explicit) && explicit >= 0) return explicit;
  return level?.pickups?.length || 0;
}

function setObjectiveStatus(text, state = 'progress') {
  if (!ui.load) return;
  if (ui.load.textContent !== text) ui.load.textContent = text;
  if (ui.load.dataset.state !== state) ui.load.dataset.state = state;
}

function clearInput() {
  input.left = false;
  input.right = false;
  input.jumpHeld = false;
  input.jumpQueued = false;
}

function syncPauseButton() {
  if (!ui.pause) return;
  ui.pause.textContent = paused ? 'Resume' : 'Pause';
  ui.pause.setAttribute('aria-pressed', String(paused));
  ui.pause.disabled = !level || !player || Boolean(player.finished);
}

function reset() {
  if (!level) return;
  player = createPlayer(level.spawn);
  elapsed = 0;
  accumulator = 0;
  previous = 0;
  cameraX = 0;
  paused = false;
  running = true;
  powerNotice = null;
  lastPowerupCount = 0;
  clearInput();
  if (ui.finish) ui.finish.hidden = true;
  syncPauseButton();
  updateHud();
  focusCanvas();
}

function guardedReset() {
  if (!player || player.finished || elapsed < 5 || window.confirm('Restart this run from the beginning? Your current run time and progress will be cleared.')) reset();
}

function togglePause(forcePause = null) {
  if (!level || !player || player.finished) return;
  const nextPaused = forcePause === null ? !paused : Boolean(forcePause);
  if (nextPaused === paused) return;
  paused = nextPaused;
  running = !paused;
  previous = 0;
  clearInput();
  syncPauseButton();
  if (!paused) focusCanvas();
}

function queueJump() {
  if (!input.jumpHeld) input.jumpQueued = true;
  input.jumpHeld = true;
}

function keyState(event, down) {
  const key = event.key.toLowerCase();
  if (down && key === 'p' && !event.repeat) {
    event.preventDefault();
    togglePause();
    return;
  }
  if (['arrowleft','arrowright','arrowup',' ','a','d','w'].includes(key)) event.preventDefault();
  if (paused) return;
  if (key === 'arrowleft' || key === 'a') input.left = down;
  if (key === 'arrowright' || key === 'd') input.right = down;
  if (key === 'arrowup' || key === 'w' || key === ' ') {
    if (down && !event.repeat) queueJump();
    else if (!down) input.jumpHeld = false;
  }
}

window.addEventListener('keydown', (event) => keyState(event, true), { passive: false });
window.addEventListener('keyup', (event) => keyState(event, false), { passive: false });
window.addEventListener('blur', clearInput);
document.addEventListener('visibilitychange', () => {
  if (document.hidden && running) togglePause(true);
});

for (const button of document.querySelectorAll('[data-control]')) {
  const control = button.dataset.control;
  const clearControl = () => {
    if (control === 'jump') input.jumpHeld = false;
    else input[control] = false;
  };
  const press = (event) => {
    event.preventDefault();
    if (paused) return;
    try { button.setPointerCapture?.(event.pointerId); } catch {}
    if (control === 'jump') queueJump();
    else input[control] = true;
  };
  const release = (event) => {
    event.preventDefault();
    clearControl();
    try {
      if (button.hasPointerCapture?.(event.pointerId)) button.releasePointerCapture(event.pointerId);
    } catch {}
  };
  button.addEventListener('pointerdown', press);
  button.addEventListener('pointerup', release);
  button.addEventListener('pointercancel', release);
  button.addEventListener('lostpointercapture', clearControl);
}

function powerLabel() {
  if (!player) return '—';
  const active = [];
  if (player.power.speedTimer > 0.05) active.push(`Speed ${Math.ceil(player.power.speedTimer)}s`);
  if (player.power.jumpTimer > 0.05) active.push(`High Jump ${Math.ceil(player.power.jumpTimer)}s`);
  if (player.power.magnetTimer > 0.05) active.push(`Magnet ${Math.ceil(player.power.magnetTimer)}s`);
  if (player.power.shieldCharges > 0) active.push(`Shield ×${player.power.shieldCharges}`);
  return active.length ? active.join(' · ') : 'None';
}

function noteNewPowerup() {
  if (!player || player.collectedPowerups.length <= lastPowerupCount) return;
  const id = player.collectedPowerups[player.collectedPowerups.length - 1];
  const powerup = level.powerups.find((item) => item.id === id);
  const labels = { speed: 'Speed Boost', jump: 'High Jump', magnet: 'Sprout Magnet', shield: 'Hazard Shield' };
  powerNotice = { text: `${labels[powerup?.type] || 'Power-up'} collected!`, until: elapsed + 2.4 };
  lastPowerupCount = player.collectedPowerups.length;
}

function updateHud() {
  const collected = player?.collected.length || 0;
  const required = requiredSprouts();
  const remaining = Math.max(0, required - collected);
  if (ui.sprouts) ui.sprouts.textContent = `${collected} / ${required}`;
  if (ui.deaths) ui.deaths.textContent = String(player?.deaths || 0);
  if (ui.time) ui.time.textContent = `${elapsed.toFixed(1)}s`;
  const best = readBest();
  if (ui.best) ui.best.textContent = best ? `${best.toFixed(1)}s` : '—';
  if (ui.power) ui.power.textContent = powerLabel();
  if (ui.jump) ui.jump.textContent = player?.grounded ? '2 jumps ready' : player?.airJumpsRemaining > 0 ? 'Double jump ready' : 'Landing resets';
  if (ui.progress && level && player) ui.progress.textContent = `${Math.min(100, Math.max(0, Math.round((player.x / level.finish.x) * 100)))}%`;

  if (!level || !player) return;
  if (powerNotice && elapsed < powerNotice.until) {
    setObjectiveStatus(`${powerNotice.text} · ${powerLabel()}`, 'power');
  } else if (player.finished) {
    setObjectiveStatus(`Run complete · all ${required} sprouts collected · Dream the Future reached!`, 'complete');
  } else if (player.finishBlocked) {
    setObjectiveStatus(`Flag locked · collect ${remaining} more sprout${remaining === 1 ? '' : 's'} before finishing.`, 'blocked');
  } else if (remaining === 0) {
    setObjectiveStatus(`All ${required} sprouts collected · reach the Dream the Future flag!`, 'ready');
  } else {
    setObjectiveStatus(`Collect ${remaining} more sprout${remaining === 1 ? '' : 's'} · tap jump for a short hop, hold for height · double jump available`, 'progress');
  }
}

function worldRect(rect, fill, stroke = null) {
  ctx.fillStyle = fill;
  ctx.fillRect(Math.round(rect.x - cameraX), rect.y, rect.width, rect.height);
  if (stroke) {
    ctx.strokeStyle = stroke;
    ctx.lineWidth = 2;
    ctx.strokeRect(Math.round(rect.x - cameraX), rect.y, rect.width, rect.height);
  }
}

function drawBackground() {
  const zone = Math.min(2, Math.floor((player?.x || 0) / 2600));
  const zoneSkies = [
    ['#bfe6ff','#dff2ce','#7fa35c'],
    ['#c9dcff','#e6efcb','#73965a'],
    ['#e1d7ff','#e7efcc','#668a54']
  ];
  const colors = zoneSkies[zone];
  const gradient = ctx.createLinearGradient(0, 0, 0, canvas.height);
  gradient.addColorStop(0, colors[0]);
  gradient.addColorStop(.7, colors[1]);
  gradient.addColorStop(1, colors[2]);
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  ctx.globalAlpha = .3;
  ctx.fillStyle = '#ffffff';
  for (let i = -1; i < 8; i += 1) {
    const x = ((i * 260 - cameraX * .18) % 2100) - 120;
    ctx.beginPath();
    ctx.arc(x, 105, 70, Math.PI, 0);
    ctx.fillRect(x - 70, 105, 140, 140);
    ctx.fill();
  }
  ctx.globalAlpha = 1;

  const zoneNames = ['Sprout Yard', 'Canopy Run', 'Dreamhouse Climb'];
  ctx.fillStyle = '#173522cc';
  ctx.font = '900 18px system-ui';
  ctx.fillText(zoneNames[zone], 24, 38);
}

function drawPlatforms() {
  for (const platform of level.platforms) {
    worldRect(platform, platform.height > 40 ? '#4e6f37' : '#5d8445', '#31552d');
    ctx.fillStyle = '#93c868';
    ctx.fillRect(Math.round(platform.x - cameraX), platform.y, platform.width, Math.min(7, platform.height));
  }
  for (const hazard of level.hazards) {
    const x = Math.round(hazard.x - cameraX);
    ctx.fillStyle = '#533927';
    ctx.fillRect(x, hazard.y, hazard.width, hazard.height);
    ctx.fillStyle = '#d78644';
    for (let px = x; px < x + hazard.width; px += 24) {
      ctx.beginPath();
      ctx.moveTo(px, hazard.y + 12);
      ctx.lineTo(px + 12, hazard.y - 10);
      ctx.lineTo(px + 24, hazard.y + 12);
      ctx.fill();
    }
  }
}

function drawPickup(pickup) {
  if (player.collected.includes(pickup.id)) return;
  const x = pickup.x - cameraX + pickup.width / 2;
  const y = pickup.y + pickup.height / 2;
  ctx.save();
  ctx.translate(x, y);
  if (player.power.magnetTimer > 0 && centerDistance(player, pickup) <= DEFAULTS.magnetRadius * 1.5) {
    ctx.strokeStyle = '#7344bd88';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(0, 0, 18 + Math.sin(elapsed * 7) * 3, 0, Math.PI * 2);
    ctx.stroke();
  }
  ctx.fillStyle = '#5a7e37';
  ctx.beginPath(); ctx.ellipse(-5, -3, 5, 10, -.55, 0, Math.PI * 2); ctx.fill();
  ctx.beginPath(); ctx.ellipse(5, -3, 5, 10, .55, 0, Math.PI * 2); ctx.fill();
  ctx.beginPath(); ctx.ellipse(0, -8, 5, 11, 0, 0, Math.PI * 2); ctx.fill();
  ctx.strokeStyle = '#29451f';
  ctx.lineWidth = 2;
  ctx.beginPath(); ctx.moveTo(0, 2); ctx.lineTo(0, 9); ctx.stroke();
  ctx.restore();
}

function drawPowerup(powerup) {
  if (player.collectedPowerups.includes(powerup.id)) return;
  const x = powerup.x - cameraX + powerup.width / 2;
  const y = powerup.y + powerup.height / 2;
  const palette = {
    speed: ['#f3c867','»'],
    jump: ['#c8f36a','↑↑'],
    magnet: ['#b58cff','U'],
    shield: ['#85d7ff','◆']
  };
  const [fill, glyph] = palette[powerup.type] || ['#ffffff','+'];
  ctx.save();
  ctx.translate(x, y);
  ctx.shadowColor = fill;
  ctx.shadowBlur = 12 + Math.sin(elapsed * 5) * 3;
  ctx.fillStyle = fill;
  ctx.beginPath(); ctx.arc(0, 0, 13 + Math.sin(elapsed * 4) * 1.5, 0, Math.PI * 2); ctx.fill();
  ctx.shadowBlur = 0;
  ctx.fillStyle = '#10291d';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.font = '900 12px system-ui';
  ctx.fillText(glyph, 0, 0);
  ctx.restore();
}

function drawCheckpoints() {
  for (const cp of checkpointsFor(level)) {
    const x = cp.x - cameraX;
    const active = player.checkpoint.id === cp.id;
    ctx.strokeStyle = '#584c35';
    ctx.lineWidth = 5;
    ctx.beginPath(); ctx.moveTo(x + 8, cp.y + cp.height); ctx.lineTo(x + 8, cp.y); ctx.stroke();
    ctx.fillStyle = active ? '#c8f36a' : '#f3c867';
    ctx.beginPath(); ctx.moveTo(x + 10, cp.y + 4); ctx.lineTo(x + 45, cp.y + 14); ctx.lineTo(x + 10, cp.y + 27); ctx.closePath(); ctx.fill();
    if (active) {
      ctx.fillStyle = '#173522';
      ctx.font = '900 10px system-ui';
      ctx.fillText('SAVED', x + 12, cp.y - 7);
    }
  }
}

function drawFinish() {
  const f = level.finish;
  const x = f.x - cameraX;
  const remaining = Math.max(0, requiredSprouts() - player.collected.length);
  const ready = remaining === 0;
  ctx.strokeStyle = ready ? '#28482f' : '#5d432e';
  ctx.lineWidth = 6;
  ctx.beginPath(); ctx.moveTo(x + 10, f.y + f.height); ctx.lineTo(x + 10, f.y); ctx.stroke();
  ctx.fillStyle = ready ? '#10291d' : '#6b4c2c';
  ctx.fillRect(x + 13, f.y + 3, 55, 24);
  ctx.fillStyle = ready ? '#c8f36a' : '#ffe1a0';
  ctx.font = 'bold 8px system-ui';
  ctx.fillText(ready ? 'DTF READY' : `${remaining} LEFT`, x + 17, f.y + 18);
}

function drawProgressRail() {
  const x = 180;
  const y = 20;
  const width = canvas.width - 360;
  const pct = Math.max(0, Math.min(1, player.x / level.finish.x));
  ctx.fillStyle = '#10291d88';
  ctx.fillRect(x, y, width, 8);
  ctx.fillStyle = '#c8f36a';
  ctx.fillRect(x, y, width * pct, 8);
  for (const cp of checkpointsFor(level)) {
    const markerX = x + width * (cp.x / level.finish.x);
    ctx.fillStyle = player.checkpoint.id === cp.id ? '#f3c867' : '#f5f7f4';
    ctx.beginPath(); ctx.arc(markerX, y + 4, 4, 0, Math.PI * 2); ctx.fill();
  }
}

function drawSeedMan() {
  const x = player.x - cameraX;
  const y = player.y;
  const facing = player.vx < 0 ? -1 : 1;
  ctx.save();
  ctx.translate(x + player.width / 2, y + player.height / 2);

  if (player.power.speedTimer > 0) {
    ctx.strokeStyle = '#f3c86788';
    ctx.lineWidth = 3;
    for (let i = 0; i < 3; i += 1) {
      ctx.beginPath();
      ctx.moveTo(-24 - i * 7, -8 + i * 8);
      ctx.lineTo(-10 - i * 5, -8 + i * 8);
      ctx.stroke();
    }
  }
  if (player.power.shieldCharges > 0 || player.power.invulnerableTimer > 0) {
    ctx.strokeStyle = '#85d7ffcc';
    ctx.lineWidth = 3;
    ctx.beginPath(); ctx.arc(0, 0, 28 + Math.sin(elapsed * 8) * 2, 0, Math.PI * 2); ctx.stroke();
  }
  if (player.state === 'double-jump') {
    ctx.strokeStyle = '#c8f36aaa';
    ctx.lineWidth = 3;
    ctx.beginPath(); ctx.ellipse(0, 23, 24, 7, 0, 0, Math.PI * 2); ctx.stroke();
  }

  ctx.strokeStyle = '#1b211c';
  ctx.lineWidth = 4;
  ctx.lineCap = 'round';
  const limb = player.state === 'run' ? Math.sin(elapsed * 13) * 6 : 0;
  ctx.beginPath(); ctx.moveTo(-10, 7); ctx.lineTo(-17, 17 + limb); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(10, 7); ctx.lineTo(17, 17 - limb); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(-11, -1); ctx.lineTo(-18, 7 - limb); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(11, -1); ctx.lineTo(18, 7 + limb); ctx.stroke();
  ctx.fillStyle = '#f7f7f2';
  ctx.beginPath(); ctx.arc(-18, 8 - limb, 5, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
  ctx.beginPath(); ctx.arc(18, 8 + limb, 5, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
  ctx.beginPath(); ctx.ellipse(-17, 20 + limb, 8, 4, 0, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
  ctx.beginPath(); ctx.ellipse(17, 20 - limb, 8, 4, 0, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
  ctx.fillStyle = '#9a6e45';
  ctx.beginPath(); ctx.ellipse(0, 0, 15, 19, -.12 * facing, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
  ctx.fillStyle = '#1b211c';
  ctx.beginPath(); ctx.arc(-5, -4, 2, 0, Math.PI * 2); ctx.arc(5, -4, 2, 0, Math.PI * 2); ctx.fill();
  ctx.beginPath(); ctx.arc(0, 3, 6, .15, Math.PI - .15); ctx.stroke();
  ctx.fillStyle = '#4b7f35';
  ctx.strokeStyle = '#264822';
  ctx.lineWidth = 2;
  for (const [dx, dy, rot] of [[0,-23,0],[-7,-20,-.55],[7,-20,.55]]) {
    ctx.save();
    ctx.translate(dx, dy);
    ctx.rotate(rot);
    ctx.beginPath(); ctx.ellipse(0, 0, 4, 9, 0, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
    ctx.restore();
  }
  ctx.restore();
}

function render() {
  if (!ctx || !canvas || !level || !player) return;
  drawBackground();
  drawPlatforms();
  level.pickups.forEach(drawPickup);
  (level.powerups || []).forEach(drawPowerup);
  drawCheckpoints();
  drawFinish();
  drawProgressRail();
  drawSeedMan();

  if (paused) {
    ctx.fillStyle = '#06110c99';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = '#f5f7f4';
    ctx.textAlign = 'center';
    ctx.font = '900 42px system-ui';
    ctx.fillText('PAUSED', canvas.width / 2, canvas.height / 2);
    ctx.textAlign = 'start';
  }
}

function finishGame() {
  running = false;
  paused = false;
  syncPauseButton();
  const previousBest = readBest();
  const newBest = previousBest === null || elapsed < previousBest;
  if (newBest) writeBest(elapsed);
  updateHud();
  if (ui.finish) ui.finish.hidden = false;
  if (ui.summary) {
    ui.summary.textContent = `${player.collected.length} of ${requiredSprouts()} sprouts · ${player.collectedPowerups.length} power-ups · ${player.deaths} falls · ${elapsed.toFixed(1)} seconds.${newBest ? ' New personal best!' : ''}`;
  }
}

function cameraBlend(frameSeconds) {
  return 1 - Math.exp(-CAMERA_FOLLOW_RATE * Math.max(0, frameSeconds));
}

function frame(timeMs) {
  if (!previous) previous = timeMs;
  const frameTime = Math.min((timeMs - previous) / 1000, .1);
  previous = timeMs;
  if (running) {
    accumulator += frameTime;
    elapsed += frameTime;
    while (accumulator >= STEP) {
      player = stepPlayer(player, {
        left: input.left,
        right: input.right,
        jumpPressed: input.jumpQueued,
        jumpHeld: input.jumpHeld
      }, level, STEP);
      input.jumpQueued = false;
      accumulator -= STEP;
      noteNewPowerup();
      if (player.finished) {
        finishGame();
        break;
      }
    }
    const lookAhead = Math.max(-90, Math.min(120, player.vx * CAMERA_LOOK_AHEAD_SECONDS));
    const targetCamera = Math.max(0, Math.min(level.worldWidth - canvas.width, player.x + lookAhead - canvas.width * .34));
    cameraX += (targetCamera - cameraX) * cameraBlend(frameTime);
    updateHud();
  }
  render();
  window.requestAnimationFrame(frame);
}

function readEmbeddedLevel() {
  const node = document.querySelector('#seed-man-level');
  if (!node) throw new Error('embedded level data missing');
  return JSON.parse(node.textContent || '');
}

function validateLevel(candidate) {
  if (
    !candidate ||
    candidate.id !== 'sprout-run' ||
    candidate.schemaVersion !== 2 ||
    candidate.worldWidth !== 7800 ||
    candidate.worldHeight !== 540 ||
    !Array.isArray(candidate.platforms) ||
    !Array.isArray(candidate.hazards) ||
    !Array.isArray(candidate.pickups) ||
    !Array.isArray(candidate.powerups) ||
    !Array.isArray(candidate.checkpoints) ||
    candidate.pickups.length !== 24 ||
    candidate.requiredPickups !== 24 ||
    candidate.requiredPickups !== candidate.pickups.length ||
    candidate.powerups.length < 7 ||
    candidate.checkpoints.length !== 3 ||
    !candidate.spawn ||
    !candidate.finish
  ) {
    throw new Error('level contract mismatch');
  }
  return candidate;
}

function load() {
  try {
    if (!canvas || !ctx) throw new Error('canvas 2D context unavailable');
    level = validateLevel(readEmbeddedLevel());
    setObjectiveStatus(`Collect all ${level.requiredPickups} sprouts · tap/hold jump control · double jump enabled · ${level.powerups.length} power-ups · ${level.checkpoints.length} checkpoints`, 'progress');
    reset();
  } catch (error) {
    console.error('Sprout Run failed to initialize.', error);
    running = false;
    setObjectiveStatus('The Seed Man level could not be loaded. Reload the page to retry.', 'error');
  }
}

ui.restart?.addEventListener('click', guardedReset);
ui.pause?.addEventListener('click', () => togglePause());
ui.again?.addEventListener('click', reset);
window.requestAnimationFrame(frame);
load();
