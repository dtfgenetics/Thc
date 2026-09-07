'use strict';

/*
 * Sprout Run production character renderer.
 * Presentation-only layer: gameplay physics/hitboxes stay owned by app.js.
 * Art direction follows the approved Seed Man green-hero visual board.
 */

const SPROUT_ART_VERSION = 'seed-man-production-v1';
const SPROUT_VISUAL_PIPELINE = 'seed-man-approved-hero-v3';
const SPROUT_POSE_CONTRACT = Object.freeze([
  'idle', 'run', 'jump', 'fall', 'boost', 'attack', 'hurt', 'checkpoint', 'finish'
]);

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

function sproutArtLeaf(x, y, rotation, width = 7, height = 12, fill = '#56cf57', stroke = '#102216') {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(rotation);
  ctx.beginPath();
  ctx.moveTo(0, 0);
  ctx.bezierCurveTo(width * 0.82, -height * 0.24, width * 0.75, -height * 0.92, 0, -height);
  ctx.bezierCurveTo(-width * 0.72, -height * 0.92, -width * 0.8, -height * 0.24, 0, 0);
  ctx.closePath();
  ctx.fillStyle = fill;
  ctx.fill();
  ctx.strokeStyle = stroke;
  ctx.lineWidth = 2.1;
  ctx.stroke();
  ctx.globalAlpha = 0.4;
  ctx.beginPath();
  ctx.moveTo(0, -1);
  ctx.lineTo(0, -height + 2);
  ctx.lineWidth = 1;
  ctx.stroke();
  ctx.restore();
}

function sproutArtGlove(x, y, rotation = 0, scale = 1, accent = '#f6fff3') {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(rotation);
  ctx.scale(scale, scale);
  ctx.fillStyle = accent;
  ctx.strokeStyle = '#102016';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.ellipse(0, 0, 4.8, 4.1, -0.08, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();
  ctx.beginPath();
  ctx.arc(3.7, -2.5, 1.9, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();
  ctx.restore();
}

function sproutArtBoot(x, y, rotation = 0, scaleX = 1, fill = '#1f9f43') {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(rotation);
  ctx.scale(scaleX, 1);
  ctx.fillStyle = fill;
  ctx.strokeStyle = '#102016';
  ctx.lineWidth = 2.15;
  sproutArtRoundedRect(-5.3, -3.1, 11.6, 6.5, 3.1);
  ctx.fill();
  ctx.stroke();
  ctx.fillStyle = '#dff9d9';
  ctx.globalAlpha = 0.75;
  ctx.fillRect(-2.6, 0.9, 6.4, 1.1);
  ctx.restore();
}

function sproutCombatSnapshot() {
  try { return window.__SPROUT_COMBAT_BROWSER__?.snapshot?.() || null; } catch { return null; }
}

function sproutPhenotypeVisual(id) {
  if (id === 'solar-flare') return {
    mode: 'fire', body: '#e84f25', suit: '#8f2c1c', light: '#ffd36a', accent: '#ff6c2f', glow: '#ff9a4b', leaf: '#ff7a31'
  };
  if (id === 'static-haze') return {
    mode: 'electric', body: '#d1e937', suit: '#6f9e22', light: '#fff58a', accent: '#ffe33e', glow: '#fff17a', leaf: '#d9ef39'
  };
  if (id === 'frost-resin') return {
    mode: 'ice', body: '#5ed7ff', suit: '#287fb8', light: '#ecfbff', accent: '#8fe7ff', glow: '#c8f6ff', leaf: '#7ce0ff'
  };
  return {
    mode: 'base', body: '#63d55d', suit: '#188842', light: '#c8ff9a', accent: '#41e35c', glow: '#78ff72', leaf: '#69e45f'
  };
}

function resolveSproutPose() {
  if (!player) return 'idle';
  if (player.finished || player.state === 'finish') return 'finish';
  if (player.state === 'hurt' || player.state === 'shield-bounce') return 'hurt';
  if (player.state === 'checkpoint') return 'checkpoint';
  if (player.state === 'boost-bounce' || player.state === 'boss-stomp' || player.state === 'stomp-bounce') return 'boost';
  if (player.state === 'attack' || player.state === 'ability') return 'attack';
  if (!player.grounded) return player.vy < -35 ? 'jump' : 'fall';
  if (Math.abs(player.vx) > 14) return 'run';
  return 'idle';
}

function drawPowerAura(visual, pose, now) {
  if (visual.mode === 'base') return;
  const pulse = 1 + Math.sin(now * 9) * 0.06;
  ctx.save();
  ctx.globalCompositeOperation = 'screen';
  ctx.strokeStyle = visual.glow;
  ctx.shadowColor = visual.glow;
  ctx.shadowBlur = pose === 'attack' ? 20 : 13;
  ctx.lineWidth = pose === 'attack' ? 4 : 2.7;
  ctx.globalAlpha = 0.56;
  ctx.beginPath();
  ctx.ellipse(0, -4, 18.5 * pulse, 25.5 * pulse, 0, 0, Math.PI * 2);
  ctx.stroke();

  if (visual.mode === 'fire') {
    for (let i = 0; i < 5; i += 1) {
      const x = -12 + i * 6;
      const rise = 8 + Math.sin(now * 12 + i * 1.7) * 4;
      ctx.fillStyle = i % 2 ? visual.light : visual.accent;
      ctx.beginPath();
      ctx.moveTo(x - 2.6, 16);
      ctx.quadraticCurveTo(x, 4 - rise, x + 3, 16);
      ctx.quadraticCurveTo(x, 10, x - 2.6, 16);
      ctx.fill();
    }
  } else if (visual.mode === 'electric') {
    ctx.strokeStyle = visual.light;
    ctx.lineWidth = 2;
    for (const side of [-1, 1]) {
      ctx.beginPath();
      ctx.moveTo(side * 10, -20);
      ctx.lineTo(side * 17, -12);
      ctx.lineTo(side * 12, -5);
      ctx.lineTo(side * 19, 1);
      ctx.lineTo(side * 13, 8);
      ctx.stroke();
    }
  } else if (visual.mode === 'ice') {
    ctx.fillStyle = visual.light;
    ctx.globalAlpha = 0.74;
    for (const [x, y, r] of [[-15,-15,2.8],[15,-10,2.3],[-14,8,2],[12,14,2.7]]) {
      ctx.save();
      ctx.translate(x, y);
      ctx.rotate(now * 0.35 + x);
      ctx.beginPath();
      ctx.moveTo(0, -r * 2.1); ctx.lineTo(r, 0); ctx.lineTo(0, r * 2.1); ctx.lineTo(-r, 0); ctx.closePath();
      ctx.fill();
      ctx.restore();
    }
  }
  ctx.restore();
}

function drawLeafHair(visual, pose, now) {
  const sway = pose === 'run' ? Math.sin(now * 15) * 0.08 : pose === 'jump' ? -0.12 : 0;
  const leaves = [
    [-8.2, -18.3, -1.08 + sway, 7.2, 12.5],
    [-3.8, -21.4, -0.58 + sway, 7.5, 14],
    [1, -22.2, -0.04 + sway, 7.7, 15],
    [6.1, -20.1, 0.58 + sway, 7.3, 13.5],
    [9.4, -16.3, 1.0 + sway, 6.5, 11.2]
  ];
  for (const [x, y, rot, w, h] of leaves) sproutArtLeaf(x, y, rot, w, h, visual.leaf);
}

function drawFace(pose, now) {
  ctx.fillStyle = '#f7fff2';
  ctx.strokeStyle = '#102016';
  ctx.lineWidth = 1.65;
  const eyeY = -7.6;
  for (const x of [-4.3, 4.3]) {
    ctx.beginPath();
    ctx.ellipse(x, eyeY, pose === 'hurt' ? 2.2 : 2.55, pose === 'hurt' ? 2.1 : 3.25, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = '#163322';
    ctx.beginPath();
    ctx.ellipse(x + 0.35, eyeY + 0.25, 1.05, 1.55, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#f7fff2';
  }

  ctx.strokeStyle = '#102016';
  ctx.lineWidth = 1.6;
  ctx.beginPath();
  if (pose === 'hurt') {
    ctx.arc(0, 0.8, 3.7, Math.PI + 0.3, Math.PI * 2 - 0.3);
  } else if (pose === 'attack') {
    ctx.moveTo(-3.4, 0); ctx.quadraticCurveTo(0, 2.1, 3.8, -0.2);
  } else {
    ctx.arc(0, -0.2, pose === 'finish' ? 4.8 : 4.15, 0.12, Math.PI - 0.12);
  }
  ctx.stroke();

  if (pose === 'finish') {
    ctx.save();
    ctx.globalAlpha = 0.55 + Math.sin(now * 8) * 0.12;
    ctx.fillStyle = '#eaff7c';
    ctx.beginPath();
    ctx.arc(-9.5, -4.8, 1.6, 0, Math.PI * 2);
    ctx.arc(9.5, -4.8, 1.6, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }
}

function drawSeedManProduction() {
  if (!player || !ctx) return;

  const screenX = player.x - cameraX;
  const screenY = player.y;
  const facing = player.vx < -1 ? -1 : 1;
  const now = performance.now() / 1000;
  const pose = resolveSproutPose();
  const combat = sproutCombatSnapshot();
  const visual = sproutPhenotypeVisual(combat?.activePhenotype || null);
  const speedRatio = Math.min(1, Math.abs(player.vx || 0) / 340);
  const runCycle = pose === 'run' ? Math.sin(now * (12 + speedRatio * 7)) : 0;
  const idleBob = pose === 'idle' ? Math.sin(now * 4.2) * 0.65 : 0;
  const hurtShake = pose === 'hurt' ? Math.sin(now * 46) * 2 : 0;

  let leftLeg = 0, rightLeg = 0, leftArm = 0, rightArm = 0;
  if (pose === 'run') {
    leftLeg = -runCycle * 5.2; rightLeg = runCycle * 5.2;
    leftArm = runCycle * 5.5; rightArm = -runCycle * 5.5;
  } else if (pose === 'jump') {
    leftLeg = -3.8; rightLeg = 3.3; leftArm = 5; rightArm = -4.7;
  } else if (pose === 'fall') {
    leftLeg = 2.7; rightLeg = -2.4; leftArm = -4.2; rightArm = 4.2;
  } else if (pose === 'boost') {
    leftLeg = -5.7; rightLeg = 5.7; leftArm = 5.6; rightArm = -5.6;
  } else if (pose === 'attack') {
    leftArm = 1.4; rightArm = -9.2;
  } else if (pose === 'finish') {
    leftArm = 8; rightArm = -8; leftLeg = -2; rightLeg = 2;
  }

  const rotation = pose === 'jump' ? -0.11 * facing : pose === 'fall' ? 0.08 * facing : pose === 'boost' ? -0.17 * facing : 0;
  const sx = pose === 'boost' ? 0.91 : pose === 'hurt' ? 1.05 : 1;
  const sy = pose === 'boost' ? 1.12 : pose === 'hurt' ? 0.94 : pose === 'jump' ? 1.05 : 1;

  ctx.save();
  ctx.translate(screenX + player.width / 2 + hurtShake, screenY + player.height / 2 + idleBob + 1);

  ctx.save();
  ctx.globalAlpha = player.grounded ? 0.25 : 0.12;
  ctx.fillStyle = '#06120b';
  ctx.beginPath();
  ctx.ellipse(0, 22.2, pose === 'run' ? 13.5 : 11.8, player.grounded ? 3.2 : 2.1, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();

  ctx.rotate(rotation);
  ctx.scale(facing * 1.16 * sx, 1.16 * sy);
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';

  drawPowerAura(visual, pose, now);

  if (player.power?.shieldCharges > 0) {
    ctx.save();
    ctx.globalAlpha = 0.3 + Math.sin(now * 6) * 0.05;
    ctx.strokeStyle = '#85e3ff';
    ctx.lineWidth = 3;
    ctx.shadowBlur = 13;
    ctx.shadowColor = '#85e3ff';
    ctx.beginPath();
    ctx.ellipse(0, -3, 20.5, 26, 0, 0, Math.PI * 2);
    ctx.stroke();
    ctx.restore();
  }

  // Compact athletic legs and boots, still outside the gameplay hitbox contract.
  ctx.strokeStyle = '#10321c';
  ctx.lineWidth = 4.4;
  sproutArtPath([[-5.2, 8], [-6.8 + leftLeg * 0.45, 14.5], [-7.8 + leftLeg, 19.4]]);
  sproutArtPath([[5.2, 8], [6.8 + rightLeg * 0.45, 14.5], [7.8 + rightLeg, 19.4]]);
  sproutArtBoot(-8.5 + leftLeg, 20.9, pose === 'run' ? -runCycle * 0.24 : -0.04, pose === 'run' ? 1.08 : 1, visual.suit);
  sproutArtBoot(8.5 + rightLeg, 20.9, pose === 'run' ? runCycle * 0.24 : 0.04, pose === 'run' ? 1.08 : 1, visual.suit);

  // Hero torso and chest emblem.
  ctx.fillStyle = visual.suit;
  ctx.strokeStyle = '#102016';
  ctx.lineWidth = 2.7;
  ctx.beginPath();
  ctx.moveTo(-8.5, -2.5);
  ctx.quadraticCurveTo(-8.2, 8, -6, 11);
  ctx.quadraticCurveTo(0, 13.2, 6, 11);
  ctx.quadraticCurveTo(8.2, 8, 8.5, -2.5);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();

  ctx.fillStyle = visual.light;
  ctx.globalAlpha = 0.82;
  ctx.beginPath();
  ctx.moveTo(0, 0.2); ctx.lineTo(3.6, 4); ctx.lineTo(0, 7.8); ctx.lineTo(-3.6, 4); ctx.closePath();
  ctx.fill();
  ctx.globalAlpha = 1;

  // Rubber-hose arms with readable action silhouettes.
  ctx.strokeStyle = '#10321c';
  ctx.lineWidth = 4.3;
  sproutArtPath([[-7.5, -1.5], [-13 + leftArm * 0.45, 1.5], [-16 + leftArm, 6.3]]);
  sproutArtPath([[7.5, -1.5], [13 + rightArm * 0.45, 1.5], [16 + rightArm, 6.3]]);
  sproutArtGlove(-17 + leftArm, 7.2, pose === 'finish' ? -0.7 : -0.22, pose === 'attack' ? 1.05 : 1, visual.light);
  sproutArtGlove(17 + rightArm, 7.2, pose === 'finish' ? 0.7 : pose === 'attack' ? -0.08 : 0.22, pose === 'attack' ? 1.2 : 1, visual.light);

  // Large expressive hero head from the approved visual direction.
  ctx.fillStyle = pose === 'hurt' ? '#85b95d' : visual.body;
  ctx.strokeStyle = '#102016';
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.ellipse(0, -8.3, 11.7, 12.1, -0.04, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();

  // Lighter muzzle/face plane gives the sprite-board look without gradients.
  ctx.fillStyle = visual.light;
  ctx.globalAlpha = 0.42;
  ctx.beginPath();
  ctx.ellipse(0, -5.9, 8.6, 7.2, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.globalAlpha = 1;

  drawFace(pose, now);
  drawLeafHair(visual, pose, now);

  if (pose === 'attack') {
    ctx.save();
    ctx.globalCompositeOperation = 'screen';
    ctx.strokeStyle = visual.accent;
    ctx.fillStyle = visual.light;
    ctx.shadowBlur = 14;
    ctx.shadowColor = visual.glow;
    ctx.globalAlpha = 0.82;
    ctx.beginPath();
    ctx.arc(23.5 + rightArm, 5.5, 4.2 + Math.sin(now * 18) * 0.7, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  if (pose === 'checkpoint' || pose === 'finish') {
    ctx.save();
    ctx.globalAlpha = pose === 'finish' ? 0.82 : 0.62;
    ctx.strokeStyle = pose === 'finish' ? '#f4dc64' : '#8aff75';
    ctx.lineWidth = 2.2;
    ctx.shadowBlur = 11;
    ctx.shadowColor = ctx.strokeStyle;
    ctx.beginPath();
    ctx.arc(0, -3, 21 + Math.sin(now * 7) * 1.5, 0, Math.PI * 2);
    ctx.stroke();
    ctx.restore();
  }

  ctx.restore();
}

function installSeedManProductionRenderer() {
  if (typeof drawSeedMan !== 'function') return false;
  drawSeedMan = drawSeedManProduction;
  window.__SPROUT_ART__ = Object.freeze({
    version: SPROUT_ART_VERSION,
    renderer: 'canvas2d-vector',
    visualPipeline: SPROUT_VISUAL_PIPELINE,
    poseContract: SPROUT_POSE_CONTRACT,
    phenotypeForms: Object.freeze(['fire', 'electric', 'ice']),
    styleReference: 'approved-seed-man-green-hero',
    original: true,
    characterContract: 'seed-man-locked-v1',
    authoritative: true
  });
  document.documentElement.dataset.seedManVisualPipeline = SPROUT_VISUAL_PIPELINE;
  document.documentElement.dataset.seedManRendererOwner = 'production-art';
  return drawSeedMan === drawSeedManProduction;
}

if (!installSeedManProductionRenderer()) {
  console.warn('Sprout Run production art layer could not find the base Seed Man renderer.');
}

window.addEventListener('DOMContentLoaded', () => {
  installSeedManProductionRenderer();
}, { once: true });

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