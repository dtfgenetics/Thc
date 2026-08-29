'use strict';

const PLAYER_SIZE = Object.freeze({ width: 34, height: 46 });
const DEFAULTS = Object.freeze({
  moveSpeed: 250,
  jumpSpeed: 520,
  gravity: 1450,
  maxFallSpeed: 900,
  coyoteTime: 0.09,
  jumpBuffer: 0.1
});

function overlaps(a, b) {
  return a.x < b.x + b.width && a.x + a.width > b.x && a.y < b.y + b.height && a.y + a.height > b.y;
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
    checkpoint: { x: spawn.x, y: spawn.y },
    collected: [],
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

function solidCollisionY(player, platform) {
  if (!overlaps(player, platform)) return;
  if (player.vy > 0) {
    player.y = platform.y - player.height;
    player.vy = 0;
    player.grounded = true;
  } else if (player.vy < 0) {
    player.y = platform.y + platform.height;
    player.vy = 0;
  }
}

function respawn(player) {
  player.x = player.checkpoint.x;
  player.y = player.checkpoint.y;
  player.vx = 0;
  player.vy = 0;
  player.grounded = false;
  player.deaths += 1;
  player.finishBlocked = false;
  player.state = 'hurt';
}

function pickupRequirement(level) {
  const explicit = Number(level?.requiredPickups);
  if (Number.isInteger(explicit) && explicit >= 0) return explicit;
  return Array.isArray(level?.pickups) ? level.pickups.length : 0;
}

function stepPlayer(inputPlayer, inputState, gameLevel, dt, config = DEFAULTS) {
  const nextPlayer = JSON.parse(JSON.stringify(inputPlayer));
  if (nextPlayer.finished) return nextPlayer;
  const step = Math.min(Math.max(dt, 0), 1 / 20);
  const requiredPickups = pickupRequirement(gameLevel);
  nextPlayer.finishBlocked = false;
  nextPlayer.missingPickups = Math.max(0, requiredPickups - nextPlayer.collected.length);

  nextPlayer.jumpBuffer = inputState.jumpPressed ? config.jumpBuffer : Math.max(0, nextPlayer.jumpBuffer - step);
  nextPlayer.coyote = nextPlayer.grounded ? config.coyoteTime : Math.max(0, nextPlayer.coyote - step);

  const direction = (inputState.right ? 1 : 0) - (inputState.left ? 1 : 0);
  nextPlayer.vx = direction * config.moveSpeed;
  if (nextPlayer.jumpBuffer > 0 && nextPlayer.coyote > 0) {
    nextPlayer.vy = -config.jumpSpeed;
    nextPlayer.grounded = false;
    nextPlayer.coyote = 0;
    nextPlayer.jumpBuffer = 0;
  }

  nextPlayer.x += nextPlayer.vx * step;
  for (const platform of gameLevel.platforms) solidCollisionX(nextPlayer, platform);

  nextPlayer.grounded = false;
  nextPlayer.vy = Math.min(config.maxFallSpeed, nextPlayer.vy + config.gravity * step);
  nextPlayer.y += nextPlayer.vy * step;
  for (const platform of gameLevel.platforms) solidCollisionY(nextPlayer, platform);

  for (const pickup of gameLevel.pickups) {
    if (!nextPlayer.collected.includes(pickup.id) && overlaps(nextPlayer, pickup)) nextPlayer.collected.push(pickup.id);
  }
  nextPlayer.missingPickups = Math.max(0, requiredPickups - nextPlayer.collected.length);

  if (gameLevel.checkpoint && overlaps(nextPlayer, gameLevel.checkpoint)) {
    nextPlayer.checkpoint = { x: gameLevel.checkpoint.respawnX, y: gameLevel.checkpoint.respawnY };
  }

  if (gameLevel.hazards.some((hazard) => overlaps(nextPlayer, hazard)) || nextPlayer.y > gameLevel.worldHeight + 160) {
    respawn(nextPlayer);
    return nextPlayer;
  }

  if (gameLevel.finish && nextPlayer.x + nextPlayer.width >= gameLevel.finish.x) {
    if (nextPlayer.missingPickups > 0) {
      nextPlayer.x = Math.min(nextPlayer.x, gameLevel.finish.x - nextPlayer.width);
      nextPlayer.vx = 0;
      nextPlayer.finishBlocked = true;
      nextPlayer.state = 'finish-blocked';
      return nextPlayer;
    }
    nextPlayer.finished = true;
    nextPlayer.finishBlocked = false;
    nextPlayer.vx = 0;
    nextPlayer.vy = 0;
    nextPlayer.state = 'finish';
    return nextPlayer;
  }

  if (!nextPlayer.grounded) nextPlayer.state = nextPlayer.vy < 0 ? 'jump' : 'fall';
  else if (Math.abs(nextPlayer.vx) > 1) nextPlayer.state = 'run';
  else nextPlayer.state = 'idle';
  return nextPlayer;
}

const BEST_KEY = 'dtf-seed-man-best-v1';
const canvas = document.querySelector('#game');
const ctx = canvas?.getContext('2d');
const ui = {
  load: document.querySelector('#load-status'),
  sprouts: document.querySelector('#sprout-count'),
  deaths: document.querySelector('#death-count'),
  time: document.querySelector('#time-count'),
  best: document.querySelector('#best-count'),
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
  clearInput();
  if (ui.finish) ui.finish.hidden = true;
  syncPauseButton();
  updateHud();
  focusCanvas();
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
    if (down) queueJump();
    else input.jumpHeld = false;
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
  const press = (event) => {
    event.preventDefault();
    if (paused) return;
    try { button.setPointerCapture?.(event.pointerId); } catch {}
    if (control === 'jump') queueJump();
    else input[control] = true;
  };
  const release = (event) => {
    event.preventDefault();
    if (control === 'jump') input.jumpHeld = false;
    else input[control] = false;
    try {
      if (button.hasPointerCapture?.(event.pointerId)) button.releasePointerCapture(event.pointerId);
    } catch {}
  };
  button.addEventListener('pointerdown', press);
  button.addEventListener('pointerup', release);
  button.addEventListener('pointercancel', release);
  button.addEventListener('pointerleave', release);
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

  if (!level || !player) return;
  if (player.finished) {
    setObjectiveStatus(`Run complete · all ${required} sprouts collected · Dream the Future reached!`, 'complete');
  } else if (player.finishBlocked) {
    setObjectiveStatus(`Flag locked · collect ${remaining} more sprout${remaining === 1 ? '' : 's'} before finishing.`, 'blocked');
  } else if (remaining === 0) {
    setObjectiveStatus(`All ${required} sprouts collected · reach the Dream the Future flag!`, 'ready');
  } else {
    setObjectiveStatus(`Collect ${remaining} more sprout${remaining === 1 ? '' : 's'} · checkpoint enabled · personal best saved locally`, 'progress');
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
  const gradient = ctx.createLinearGradient(0, 0, 0, canvas.height);
  gradient.addColorStop(0, '#bfe6ff');
  gradient.addColorStop(.7, '#dff2ce');
  gradient.addColorStop(1, '#7fa35c');
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.globalAlpha = .35;
  ctx.fillStyle = '#ffffff';
  for (let i = -1; i < 8; i += 1) {
    const x = ((i * 260 - cameraX * .18) % 2100) - 120;
    ctx.beginPath();
    ctx.arc(x, 105, 70, Math.PI, 0);
    ctx.fillRect(x - 70, 105, 140, 140);
    ctx.fill();
  }
  ctx.globalAlpha = 1;
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
  ctx.fillStyle = '#5a7e37';
  ctx.beginPath(); ctx.ellipse(-5, -3, 5, 10, -.55, 0, Math.PI * 2); ctx.fill();
  ctx.beginPath(); ctx.ellipse(5, -3, 5, 10, .55, 0, Math.PI * 2); ctx.fill();
  ctx.beginPath(); ctx.ellipse(0, -8, 5, 11, 0, 0, Math.PI * 2); ctx.fill();
  ctx.strokeStyle = '#29451f'; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(0, 2); ctx.lineTo(0, 9); ctx.stroke();
  ctx.restore();
}

function drawCheckpoint() {
  const cp = level.checkpoint;
  const x = cp.x - cameraX;
  const active = player.checkpoint.x === cp.respawnX && player.checkpoint.y === cp.respawnY;
  ctx.strokeStyle = '#584c35'; ctx.lineWidth = 5; ctx.beginPath(); ctx.moveTo(x + 8, cp.y + cp.height); ctx.lineTo(x + 8, cp.y); ctx.stroke();
  ctx.fillStyle = active ? '#c8f36a' : '#f3c867';
  ctx.beginPath(); ctx.moveTo(x + 10, cp.y + 4); ctx.lineTo(x + 45, cp.y + 14); ctx.lineTo(x + 10, cp.y + 27); ctx.closePath(); ctx.fill();
}

function drawFinish() {
  const f = level.finish;
  const x = f.x - cameraX;
  const remaining = Math.max(0, requiredSprouts() - player.collected.length);
  const ready = remaining === 0;
  ctx.strokeStyle = ready ? '#28482f' : '#5d432e';
  ctx.lineWidth = 6;
  ctx.beginPath();
  ctx.moveTo(x + 10, f.y + f.height);
  ctx.lineTo(x + 10, f.y);
  ctx.stroke();
  ctx.fillStyle = ready ? '#10291d' : '#6b4c2c';
  ctx.fillRect(x + 13, f.y + 3, 48, 24);
  ctx.fillStyle = ready ? '#c8f36a' : '#ffe1a0';
  ctx.font = 'bold 8px system-ui';
  ctx.fillText(ready ? 'DTF READY' : `${remaining} LEFT`, x + 17, f.y + 18);
}

function drawSeedMan() {
  const x = player.x - cameraX;
  const y = player.y;
  const facing = player.vx < 0 ? -1 : 1;
  ctx.save(); ctx.translate(x + player.width / 2, y + player.height / 2);
  ctx.strokeStyle = '#1b211c'; ctx.lineWidth = 4; ctx.lineCap = 'round';
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
  ctx.fillStyle = '#4b7f35'; ctx.strokeStyle = '#264822'; ctx.lineWidth = 2;
  for (const [dx,dy,rot] of [[0,-23,0],[-7,-20,-.55],[7,-20,.55]]) {
    ctx.save(); ctx.translate(dx,dy); ctx.rotate(rot); ctx.beginPath(); ctx.ellipse(0,0,4,9,0,0,Math.PI*2); ctx.fill(); ctx.stroke(); ctx.restore();
  }
  ctx.restore();
}

function render() {
  if (!ctx || !canvas || !level || !player) return;
  drawBackground();
  drawPlatforms();
  level.pickups.forEach(drawPickup);
  drawCheckpoint();
  drawFinish();
  drawSeedMan();
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
    ui.summary.textContent = `${player.collected.length} of ${requiredSprouts()} sprouts collected · ${player.deaths} falls · ${elapsed.toFixed(1)} seconds.${newBest ? ' New personal best!' : ''}`;
  }
}

function frame(timeMs) {
  if (!previous) previous = timeMs;
  const frameTime = Math.min((timeMs - previous) / 1000, .1);
  previous = timeMs;
  if (running) {
    accumulator += frameTime;
    elapsed += frameTime;
    while (accumulator >= STEP) {
      player = stepPlayer(player, { left: input.left, right: input.right, jumpPressed: input.jumpQueued }, level, STEP);
      input.jumpQueued = false;
      accumulator -= STEP;
      if (player.finished) { finishGame(); break; }
    }
    const targetCamera = Math.max(0, Math.min(level.worldWidth - canvas.width, player.x - canvas.width * .34));
    cameraX += (targetCamera - cameraX) * .12;
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
    candidate.worldWidth !== 2600 ||
    candidate.worldHeight !== 540 ||
    !Array.isArray(candidate.platforms) ||
    !Array.isArray(candidate.hazards) ||
    !Array.isArray(candidate.pickups) ||
    candidate.pickups.length !== 8 ||
    candidate.requiredPickups !== 8 ||
    candidate.requiredPickups !== candidate.pickups.length ||
    !candidate.spawn ||
    !candidate.checkpoint ||
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
    setObjectiveStatus(`Collect all ${level.requiredPickups} sprouts · checkpoint enabled · personal best saved locally`, 'progress');
    reset();
  } catch (error) {
    console.error('Sprout Run failed to initialize.', error);
    running = false;
    setObjectiveStatus('The Seed Man level could not be loaded. Reload the page to retry.', 'error');
  }
}

ui.restart?.addEventListener('click', reset);
ui.pause?.addEventListener('click', () => togglePause());
ui.again?.addEventListener('click', reset);
window.requestAnimationFrame(frame);
load();
