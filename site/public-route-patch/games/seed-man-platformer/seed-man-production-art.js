'use strict';

/*
 * Sprout Run production character renderer.
 * Keeps the locked Seed Man silhouette independent from gameplay physics.
 * Original DTF Genetics vector-style Canvas2D art; no third-party assets.
 */

const SPROUT_ART_VERSION = 'seed-man-production-v1';

function sproutArtPath(points) {
  ctx.beginPath();
  ctx.moveTo(points[0][0], points[0][1]);
  for (let i = 1; i < points.length; i += 1) ctx.lineTo(points[i][0], points[i][1]);
  ctx.stroke();
}

function sproutArtRoundedRect(x, y, width, height, radius) {
  const r = Math.max(0, Math.min(radius, Math.abs(width) / 2, Math.abs(height) / 2));
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + width - r, y);
  ctx.quadraticCurveTo(x + width, y, x + width, y + r);
  ctx.lineTo(x + width, y + height - r);
  ctx.quadraticCurveTo(x + width, y + height, x + width - r, y + height);
  ctx.lineTo(x + r, y + height);
  ctx.quadraticCurveTo(x, y + height, x, y + height - r);
  ctx.lineTo(x, y + r);
  ctx.quadraticCurveTo(x, y, x + r, y);
  ctx.closePath();
}

function sproutArtLeaf(x, y, rotation, width = 8, height = 13) {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(rotation);
  ctx.beginPath();
  ctx.moveTo(0, 0);
  ctx.bezierCurveTo(width * 0.75, -height * 0.3, width * 0.7, -height * 0.9, 0, -height);
  ctx.bezierCurveTo(-width * 0.7, -height * 0.9, -width * 0.75, -height * 0.3, 0, 0);
  ctx.closePath();
  ctx.fillStyle = '#4fae58';
  ctx.fill();
  ctx.lineWidth = 2.2;
  ctx.strokeStyle = '#172019';
  ctx.stroke();
  ctx.restore();
}

function sproutArtGlove(x, y, rotation = 0) {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(rotation);
  ctx.fillStyle = '#ffffff';
  ctx.strokeStyle = '#171817';
  ctx.lineWidth = 2.1;
  ctx.beginPath();
  ctx.ellipse(0, 0, 4.7, 4.1, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();
  ctx.beginPath();
  ctx.arc(3.7, -2.6, 2.1, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();
  ctx.restore();
}

function sproutArtShoe(x, y, rotation = 0) {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(rotation);
  ctx.fillStyle = '#ffffff';
  ctx.strokeStyle = '#171817';
  ctx.lineWidth = 2.2;
  sproutArtRoundedRect(-4.8, -2.6, 10.2, 5.8, 2.8);
  ctx.fill();
  ctx.stroke();
  ctx.restore();
}

function drawSeedManProduction() {
  if (!player || !ctx) return;

  const screenX = player.x - cameraX;
  const screenY = player.y;
  const facing = player.vx < -1 ? -1 : 1;
  const now = performance.now() / 1000;
  const runningState = player.grounded && Math.abs(player.vx) > 1;
  const runCycle = runningState ? Math.sin(now * 15) : 0;
  const idleBob = player.grounded && !runningState ? Math.sin(now * 4) * 0.55 : 0;
  const airborne = !player.grounded;
  const hurtShake = player.state === 'hurt' ? Math.sin(now * 42) * 1.7 : 0;
  const doubleJumpTilt = player.state === 'double-jump' ? -0.11 * facing : 0;

  const legSwing = runningState ? runCycle * 3.4 : airborne ? 2.1 : 0;
  const armSwing = runningState ? -runCycle * 3.6 : airborne ? -2.2 : 0;

  ctx.save();
  ctx.translate(screenX + player.width / 2 + hurtShake, screenY + player.height / 2 + idleBob);
  ctx.rotate(doubleJumpTilt);
  ctx.scale(facing, 1);
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';

  if (player.power?.shieldCharges > 0) {
    ctx.save();
    ctx.globalAlpha = 0.28 + Math.sin(now * 6) * 0.05;
    ctx.strokeStyle = '#76d7ff';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.ellipse(0, -2, 21, 27, 0, 0, Math.PI * 2);
    ctx.stroke();
    ctx.restore();
  }

  // Rubber-hose legs, behind the body.
  ctx.strokeStyle = '#171817';
  ctx.lineWidth = 4.1;
  sproutArtPath([[-5, 9], [-6 - legSwing, 15], [-7 - legSwing * 0.7, 20]]);
  sproutArtPath([[5, 9], [6 + legSwing, 15], [7 + legSwing * 0.7, 20]]);
  sproutArtShoe(-8 - legSwing * 0.7, 21, runningState ? -runCycle * 0.18 : -0.05);
  sproutArtShoe(8 + legSwing * 0.7, 21, runningState ? runCycle * 0.18 : 0.05);

  // Rubber-hose arms and white gloves.
  sproutArtPath([[-10, -3], [-15 - armSwing, 2], [-16 - armSwing * 0.8, 7]]);
  sproutArtPath([[10, -3], [15 + armSwing, 2], [16 + armSwing * 0.8, 7]]);
  sproutArtGlove(-17 - armSwing * 0.8, 8, -0.25);
  sproutArtGlove(17 + armSwing * 0.8, 8, 0.25);

  // Chubby seed body: flat color, thick outline, no realistic shading.
  ctx.fillStyle = player.state === 'hurt' ? '#be7b4c' : '#a9683f';
  ctx.strokeStyle = '#171817';
  ctx.lineWidth = 3.2;
  ctx.beginPath();
  ctx.ellipse(0, -4, 12.7, 15.1, -0.08, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();

  // Small flat seed accent keeps volume readable without gradients.
  ctx.fillStyle = '#c98b5f';
  ctx.beginPath();
  ctx.ellipse(-5.2, -9.4, 2.1, 4.7, -0.35, 0, Math.PI * 2);
  ctx.fill();

  // Simple canonical face.
  ctx.fillStyle = '#171817';
  ctx.beginPath();
  ctx.ellipse(-4.1, -6, 1.45, 2.15, 0, 0, Math.PI * 2);
  ctx.ellipse(4.1, -6, 1.45, 2.15, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = '#171817';
  ctx.lineWidth = 1.8;
  ctx.beginPath();
  ctx.arc(0, -1.3, 4.1, 0.18, Math.PI - 0.18);
  ctx.stroke();

  // Three-leaf sprout, centered and permanently part of the silhouette.
  ctx.strokeStyle = '#172019';
  ctx.lineWidth = 2.3;
  sproutArtPath([[0, -18], [0, -23]]);
  sproutArtLeaf(0, -21.5, 0, 7.2, 11.5);
  sproutArtLeaf(-0.8, -21, -0.72, 7, 10.5);
  sproutArtLeaf(0.8, -21, 0.72, 7, 10.5);

  if (player.state === 'checkpoint') {
    ctx.save();
    ctx.globalAlpha = 0.75;
    ctx.strokeStyle = '#c8f36a';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(0, -3, 20, 0, Math.PI * 2);
    ctx.stroke();
    ctx.restore();
  }

  ctx.restore();
}

if (typeof drawSeedMan === 'function') {
  drawSeedMan = drawSeedManProduction;
  window.__SPROUT_ART__ = Object.freeze({
    version: SPROUT_ART_VERSION,
    renderer: 'canvas2d-vector',
    original: true,
    characterContract: 'seed-man-locked-v1'
  });
} else {
  console.warn('Sprout Run production art layer could not find the base Seed Man renderer.');
}

function installSproutRunShellV2() {
  const shell = document.querySelector('.game-shell');
  const hud = shell?.querySelector('.hud');
  const canvasNode = document.querySelector('#game');
  if (!shell || !hud || !canvasNode || shell.dataset.uiV2 === 'ready') return;

  shell.dataset.uiV2 = 'ready';

  const primaryIds = new Set(['sprout-count', 'progress-count', 'jump-count', 'power-count']);
  for (const span of [...hud.children].filter((node) => node.tagName === 'SPAN')) {
    const value = span.querySelector('strong[id]');
    if (!value) continue;
    span.classList.add('hud-stat');
    span.classList.add(primaryIds.has(value.id) ? 'hud-stat--primary' : 'hud-stat--secondary');
    span.dataset.metric = value.id.replace(/-count$/, '');
  }

  const actions = document.createElement('div');
  actions.className = 'hud-actions';
  for (const button of [...hud.children].filter((node) => node.tagName === 'BUTTON')) actions.append(button);
  hud.append(actions);

  const course = document.createElement('section');
  course.className = 'course-status';
  course.setAttribute('aria-label', 'Greenhouse course progress');
  course.innerHTML = `
    <div class="course-status-copy">
      <span class="course-kicker">GREENHOUSE GAUNTLET</span>
      <strong id="course-stage">Stage 1 / 3 · Propagation Bay</strong>
    </div>
    <div class="course-track" aria-hidden="true">
      <span id="course-progress-fill"></span>
      <i class="course-checkpoint cp-one"></i>
      <i class="course-checkpoint cp-two"></i>
      <i class="course-checkpoint cp-three"></i>
    </div>`;
  hud.after(course);

  const touch = shell.querySelector('.touch-controls');
  if (touch) {
    const quick = document.createElement('p');
    quick.className = 'quick-controls';
    quick.innerHTML = '<strong>MOVE</strong> A/D or ←/→ <span>·</span> <strong>JUMP</strong> Space/W/↑ <span>·</span> <strong>PAUSE</strong> P';
    touch.after(quick);
  }

  const controls = shell.querySelector('.controls');
  if (controls && !controls.closest('.control-help')) {
    const details = document.createElement('details');
    details.className = 'control-help';
    const summary = document.createElement('summary');
    summary.textContent = 'Full controls & power-up guide';
    controls.before(details);
    details.append(summary, controls);
  }

  const progress = document.querySelector('#progress-count');
  const power = document.querySelector('#power-count');
  const pause = document.querySelector('#pause');
  const status = document.querySelector('#load-status');
  const finish = document.querySelector('#finish-panel');
  const stageNode = document.querySelector('#course-stage');
  const fill = document.querySelector('#course-progress-fill');

  const stages = [
    { max: 32, label: 'Stage 1 / 3 · Propagation Bay', key: 'propagation' },
    { max: 65, label: 'Stage 2 / 3 · Canopy Run', key: 'canopy' },
    { max: 100, label: 'Stage 3 / 3 · Final Greenhouse', key: 'finish-house' }
  ];

  const syncShellState = () => {
    const percent = Math.min(100, Math.max(0, Number.parseInt(progress?.textContent || '0', 10) || 0));
    const stage = stages.find((item) => percent <= item.max) || stages[stages.length - 1];
    if (stageNode) stageNode.textContent = stage.label;
    if (fill) fill.style.width = `${percent}%`;
    shell.dataset.stage = stage.key;
    shell.dataset.objectiveState = status?.dataset.state || 'progress';
    shell.dataset.paused = pause?.getAttribute('aria-pressed') === 'true' ? 'true' : 'false';
    shell.dataset.power = power && power.textContent.trim() !== 'None' ? 'active' : 'none';
    shell.dataset.complete = finish && !finish.hidden ? 'true' : 'false';
  };

  syncShellState();

  if (typeof MutationObserver === 'function') {
    const observer = new MutationObserver(syncShellState);
    for (const node of [progress, power, pause, status, finish].filter(Boolean)) {
      observer.observe(node, { subtree: true, childList: true, characterData: true, attributes: true });
    }
  }

  window.__SPROUT_UI_V2__ = Object.freeze({
    version: 'sprout-run-ui-v2',
    stages: stages.map(({ label, key }) => ({ label, key })),
    sync: syncShellState
  });
}

installSproutRunShellV2();
