import { createPlayer, stepPlayer } from './physics.mjs';

const BEST_KEY = 'dtf-seed-man-best-v1';
const canvas = document.querySelector('#game');
const ctx = canvas.getContext('2d');
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
  const value = Number.parseFloat(localStorage.getItem(BEST_KEY) || '');
  return Number.isFinite(value) && value > 0 ? value : null;
}

function clearInput() {
  input.left = false;
  input.right = false;
  input.jumpHeld = false;
  input.jumpQueued = false;
}

function syncPauseButton() {
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
  ui.finish.hidden = true;
  syncPauseButton();
  updateHud();
  canvas.focus({ preventScroll: true });
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
  if (!paused) canvas.focus({ preventScroll: true });
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
    if (control === 'jump') queueJump();
    else input[control] = true;
  };
  const release = (event) => {
    event.preventDefault();
    if (control === 'jump') input.jumpHeld = false;
    else input[control] = false;
  };
  button.addEventListener('pointerdown', press);
  button.addEventListener('pointerup', release);
  button.addEventListener('pointercancel', release);
  button.addEventListener('pointerleave', release);
}

function updateHud() {
  ui.sprouts.textContent = `${player?.collected.length || 0} / ${level?.pickups.length || 0}`;
  ui.deaths.textContent = String(player?.deaths || 0);
  ui.time.textContent = `${elapsed.toFixed(1)}s`;
  const best = readBest();
  ui.best.textContent = best ? `${best.toFixed(1)}s` : '—';
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
  const f = level.finish; const x = f.x - cameraX;
  ctx.strokeStyle = '#28482f'; ctx.lineWidth = 6; ctx.beginPath(); ctx.moveTo(x + 10, f.y + f.height); ctx.lineTo(x + 10, f.y); ctx.stroke();
  ctx.fillStyle = '#10291d'; ctx.fillRect(x + 13, f.y + 3, 35, 22);
  ctx.fillStyle = '#c8f36a'; ctx.font = 'bold 9px system-ui'; ctx.fillText('DTF', x + 20, f.y + 18);
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
  if (newBest) localStorage.setItem(BEST_KEY, String(elapsed));
  updateHud();
  ui.finish.hidden = false;
  ui.summary.textContent = `${player.collected.length} of ${level.pickups.length} sprouts collected · ${player.deaths} falls · ${elapsed.toFixed(1)} seconds.${newBest ? ' New personal best!' : ''}`;
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
  if (level && player) render();
  requestAnimationFrame(frame);
}

async function load() {
  try {
    const response = await fetch('./data/level-01.json', { credentials: 'same-origin' });
    if (!response.ok) throw new Error(`level HTTP ${response.status}`);
    level = await response.json();
    if (level.worldWidth !== 2600 || level.pickups.length !== 8) throw new Error('level contract mismatch');
    ui.load.textContent = 'Level ready · 8 sprouts · checkpoint enabled · personal best saved locally';
    reset();
  } catch (error) {
    console.error(error);
    ui.load.textContent = 'The Seed Man level could not be loaded.';
  }
}

ui.restart.addEventListener('click', reset);
ui.pause.addEventListener('click', () => togglePause());
ui.again.addEventListener('click', reset);
requestAnimationFrame(frame);
load();
