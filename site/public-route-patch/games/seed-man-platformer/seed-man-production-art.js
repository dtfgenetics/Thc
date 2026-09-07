'use strict';

/*
 * Sprout Run production character renderer.
 * Keeps the locked Seed Man silhouette independent from gameplay physics.
 * Original DTF Genetics vector-style Canvas2D art; no third-party assets.
 */

const SPROUT_ART_VERSION = 'seed-man-production-v1';
const SPROUT_VISUAL_PIPELINE = 'seed-man-sprite-look-v2';
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

function sproutArtLeaf(x, y, rotation, width = 8, height = 13, fill = '#58bd61') {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(rotation);
  ctx.beginPath();
  ctx.moveTo(0, 0);
  ctx.bezierCurveTo(width * 0.78, -height * 0.28, width * 0.72, -height * 0.9, 0, -height);
  ctx.bezierCurveTo(-width * 0.72, -height * 0.9, -width * 0.78, -height * 0.28, 0, 0);
  ctx.closePath();
  ctx.fillStyle = fill;
  ctx.fill();
  ctx.lineWidth = 2.5;
  ctx.strokeStyle = '#151816';
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(0, -1);
  ctx.lineTo(0, -height + 2);
  ctx.lineWidth = 1;
  ctx.globalAlpha = 0.45;
  ctx.stroke();
  ctx.restore();
}

function sproutArtGlove(x, y, rotation = 0, scale = 1) {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(rotation);
  ctx.scale(scale, scale);
  ctx.fillStyle = '#fffef8';
  ctx.strokeStyle = '#151616';
  ctx.lineWidth = 2.3;
  ctx.beginPath();
  ctx.ellipse(0, 0, 5.3, 4.5, -0.08, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();
  ctx.beginPath();
  ctx.arc(4.1, -2.8, 2.25, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();
  ctx.restore();
}

function sproutArtShoe(x, y, rotation = 0, scaleX = 1) {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(rotation);
  ctx.scale(scaleX, 1);
  ctx.fillStyle = '#fffef8';
  ctx.strokeStyle = '#151616';
  ctx.lineWidth = 2.35;
  sproutArtRoundedRect(-5.6, -2.8, 11.8, 6.4, 3.1);
  ctx.fill();
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(-3.4, 1.7);
  ctx.lineTo(3.9, 1.7);
  ctx.lineWidth = 1.05;
  ctx.globalAlpha = 0.45;
  ctx.stroke();
  ctx.restore();
}

function sproutActivePhenotype() {
  try {
    return window.__SPROUT_COMBAT_BROWSER__?.snapshot?.()?.activePhenotype || null;
  } catch {
    return null;
  }
}

function sproutPhenotypeVisual(id) {
  if (id === 'solar-flare') return { accent: '#ff8a3d', secondary: '#ffd274', body: '#b9683b', mode: 'fire' };
  if (id === 'static-haze') return { accent: '#cdb7ff', secondary: '#f0e6ff', body: '#9c6a52', mode: 'electric' };
  if (id === 'frost-resin') return { accent: '#8fe7ff', secondary: '#e8fbff', body: '#956e59', mode: 'ice' };
  return null;
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

function drawSproutPhenotypeAura(visual, pose, now) {
  if (!visual) return;
  const pulse = 1 + Math.sin(now * 8.5) * 0.07;
  ctx.save();
  ctx.globalCompositeOperation = 'screen';
  ctx.globalAlpha = 0.48;
  ctx.strokeStyle = visual.accent;
  ctx.shadowColor = visual.accent;
  ctx.shadowBlur = pose === 'attack' ? 18 : 12;
  ctx.lineWidth = pose === 'attack' ? 4 : 2.8;
  ctx.beginPath();
  ctx.ellipse(0, -3, 18 * pulse, 24 * pulse, 0, 0, Math.PI * 2);
  ctx.stroke();

  if (visual.mode === 'fire') {
    for (let i = 0; i < 3; i += 1) {
      const x = -10 + i * 10;
      const rise = 5 + Math.sin(now * 12 + i) * 3;
      ctx.fillStyle = i === 1 ? visual.secondary : visual.accent;
      ctx.beginPath();
      ctx.moveTo(x - 3, 13);
      ctx.quadraticCurveTo(x + 1, 4 - rise, x + 4, 13);
      ctx.quadraticCurveTo(x, 8, x - 3, 13);
      ctx.fill();
    }
  } else if (visual.mode === 'electric') {
    ctx.strokeStyle = visual.secondary;
    ctx.lineWidth = 2;
    for (const side of [-1, 1]) {
      ctx.beginPath();
      ctx.moveTo(side * 13, -16);
      ctx.lineTo(side * 18, -8);
      ctx.lineTo(side * 12, -3);
      ctx.lineTo(side * 18, 4);
      ctx.stroke();
    }
  } else if (visual.mode === 'ice') {
    ctx.fillStyle = visual.secondary;
    ctx.globalAlpha = 0.7;
    for (const [x, y, r] of [[-15,-12,2.4],[15,-8,2.1],[-13,10,1.8],[12,14,2.6]]) {
      ctx.save();
      ctx.translate(x, y);
      ctx.rotate(now * 0.4 + x);
      ctx.beginPath();
      ctx.moveTo(0, -r * 2);
      ctx.lineTo(r, 0);
      ctx.lineTo(0, r * 2);
      ctx.lineTo(-r, 0);
      ctx.closePath();
      ctx.fill();
      ctx.restore();
    }
  }
  ctx.restore();
}

function drawSeedManProduction() {
  if (!player || !ctx) return;

  const screenX = player.x - cameraX;
  const screenY = player.y;
  const facing = player.vx < -1 ? -1 : 1;
  const now = performance.now() / 1000;
  const pose = resolveSproutPose();
  const phenotype = sproutPhenotypeVisual(sproutActivePhenotype());
  const speedRatio = Math.min(1, Math.abs(player.vx || 0) / 340);
  const runCycle = pose === 'run' ? Math.sin(now * (12 + speedRatio * 6)) : 0;
  const idleBob = pose === 'idle' ? Math.sin(now * 4.1) * 0.75 : 0;
  const hurtShake = pose === 'hurt' ? Math.sin(now * 46) * 2.2 : 0;

  const poseRotation = pose === 'jump' ? -0.12 * facing : pose === 'fall' ? 0.08 * facing : pose === 'boost' ? -0.18 * facing : pose === 'hurt' ? 0.12 * Math.sin(now * 24) : 0;
  const poseScaleX = pose === 'boost' ? 0.9 : pose === 'hurt' ? 1.08 : pose === 'finish' ? 1.04 : 1;
  const poseScaleY = pose === 'boost' ? 1.14 : pose === 'hurt' ? 0.92 : pose === 'jump' ? 1.06 : 1;

  let leftLeg = 0;
  let rightLeg = 0;
  let leftArm = 0;
  let rightArm = 0;
  if (pose === 'run') {
    leftLeg = -runCycle * 5.1;
    rightLeg = runCycle * 5.1;
    leftArm = runCycle * 5.4;
    rightArm = -runCycle * 5.4;
  } else if (pose === 'jump') {
    leftLeg = -3.4; rightLeg = 3.2; leftArm = 4.6; rightArm = -4.2;
  } else if (pose === 'fall') {
    leftLeg = 2.7; rightLeg = -2.2; leftArm = -3.8; rightArm = 3.8;
  } else if (pose === 'boost') {
    leftLeg = -5.5; rightLeg = 5.5; leftArm = 5.2; rightArm = -5.2;
  } else if (pose === 'attack') {
    leftArm = 1.5; rightArm = -8.5;
  } else if (pose === 'finish') {
    leftArm = 7.5; rightArm = -7.5; leftLeg = -1.8; rightLeg = 1.8;
  }

  ctx.save();
  ctx.translate(screenX + player.width / 2 + hurtShake, screenY + player.height / 2 + idleBob + 1);

  // Soft contact shadow gives the sprite visual weight against the 3D world.
  ctx.save();
  ctx.globalAlpha = player.grounded ? 0.26 : 0.13;
  ctx.fillStyle = '#07140d';
  ctx.scale(facing, 1);
  ctx.beginPath();
  ctx.ellipse(0, 22, pose === 'run' ? 13 : 11, player.grounded ? 3.2 : 2.2, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();

  ctx.rotate(poseRotation);
  ctx.scale(facing * 1.16 * poseScaleX, 1.16 * poseScaleY);
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';

  drawSproutPhenotypeAura(phenotype, pose, now);

  if (player.power?.shieldCharges > 0) {
    ctx.save();
    ctx.globalAlpha = 0.26 + Math.sin(now * 6) * 0.05;
    ctx.strokeStyle = '#76d7ff';
    ctx.lineWidth = 3.2;
    ctx.shadowBlur = 12;
    ctx.shadowColor = '#76d7ff';
    ctx.beginPath();
    ctx.ellipse(0, -2, 20, 26, 0, 0, Math.PI * 2);
    ctx.stroke();
    ctx.restore();
  }

  // Rubber-hose limbs remain unmistakably Seed Man, but pose more like authored sprite frames.
  ctx.strokeStyle = '#151616';
  ctx.lineWidth = 4.25;
  sproutArtPath([[-5.5, 8.5], [-7 + leftLeg * 0.45, 15], [-8 + leftLeg, 20]]);
  sproutArtPath([[5.5, 8.5], [7 + rightLeg * 0.45, 15], [8 + rightLeg, 20]]);
  sproutArtShoe(-8.7 + leftLeg, 21.1, pose === 'run' ? -runCycle * 0.26 : -0.06, pose === 'run' ? 1.08 : 1);
  sproutArtShoe(8.7 + rightLeg, 21.1, pose === 'run' ? runCycle * 0.26 : 0.06, pose === 'run' ? 1.08 : 1);

  sproutArtPath([[-10.6, -3], [-15 + leftArm * 0.5, 1.2], [-17 + leftArm, 7]]);
  sproutArtPath([[10.6, -3], [15 + rightArm * 0.5, 1.2], [17 + rightArm, 7]]);
  sproutArtGlove(-18 + leftArm, 8, pose === 'finish' ? -0.7 : -0.24, pose === 'attack' ? 1.05 : 1);
  sproutArtGlove(18 + rightArm, 8, pose === 'finish' ? 0.7 : pose === 'attack' ? -0.1 : 0.24, pose === 'attack' ? 1.18 : 1);

  // Chubby oval body, flat colors, thick readable outline.
  const baseBody = pose === 'hurt' ? '#c27a4a' : phenotype?.body || '#aa6940';
  ctx.fillStyle = baseBody;
  ctx.strokeStyle = '#151616';
  ctx.lineWidth = 3.45;
  ctx.beginPath();
  ctx.ellipse(0, -4.2, 13.3, 15.7, -0.08, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();

  // Flat highlight and shell seam make the character read like a polished sprite without realistic shading.
  ctx.fillStyle = phenotype?.secondary || '#d39667';
  ctx.globalAlpha = phenotype ? 0.36 : 0.7;
  ctx.beginPath();
  ctx.ellipse(-5.2, -9.4, 2.35, 5.15, -0.32, 0, Math.PI * 2);
  ctx.fill();
  ctx.globalAlpha = 1;
  ctx.strokeStyle = 'rgba(54,31,20,.42)';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.arc(1.5, -4, 8.2, 1.18, 2.2);
  ctx.stroke();

  // Face changes by gameplay pose so animation reads clearly even at phone size.
  ctx.fillStyle = '#151616';
  const eyeSquint = pose === 'hurt' ? 0.7 : pose === 'finish' ? 1.15 : 1;
  ctx.beginPath();
  ctx.ellipse(-4.2, -6.3, 1.55, 2.25 * eyeSquint, 0, 0, Math.PI * 2);
  ctx.ellipse(4.2, -6.3, 1.55, 2.25 * eyeSquint, 0, 0, Math.PI * 2);
  ctx.fill();

  ctx.strokeStyle = '#151616';
  ctx.lineWidth = 1.9;
  ctx.beginPath();
  if (pose === 'hurt') {
    ctx.arc(0, 1.9, 3.7, Math.PI + 0.28, Math.PI * 2 - 0.28);
  } else if (pose === 'attack') {
    ctx.moveTo(-3.3, -0.2); ctx.quadraticCurveTo(0, 1.6, 3.7, -0.6);
  } else {
    ctx.arc(0, -1.4, pose === 'finish' ? 5.1 : 4.25, 0.16, Math.PI - 0.16);
  }
  ctx.stroke();

  // Three-leaf sprout stays permanently centered and visually dominant.
  ctx.strokeStyle = '#151816';
  ctx.lineWidth = 2.45;
  sproutArtPath([[0, -18.5], [0, -24.1]]);
  const leafFill = phenotype?.mode === 'ice' ? '#69c9a8' : '#58bd61';
  sproutArtLeaf(0, -22.2, 0, 7.5, 12, leafFill);
  sproutArtLeaf(-1, -21.6, -0.74, 7.2, 10.8, leafFill);
  sproutArtLeaf(1, -21.6, 0.74, 7.2, 10.8, leafFill);

  if (pose === 'checkpoint' || pose === 'finish') {
    ctx.save();
    ctx.globalAlpha = pose === 'finish' ? 0.8 : 0.62;
    ctx.strokeStyle = pose === 'finish' ? '#f3d36a' : '#c8f36a';
    ctx.lineWidth = 2.2;
    ctx.shadowBlur = 10;
    ctx.shadowColor = ctx.strokeStyle;
    ctx.beginPath();
    ctx.arc(0, -3, 20 + Math.sin(now * 7) * 1.5, 0, Math.PI * 2);
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
    visualPipeline: SPROUT_VISUAL_PIPELINE,
    poseContract: SPROUT_POSE_CONTRACT,
    phenotypeForms: Object.freeze(['fire', 'electric', 'ice']),
    original: true,
    characterContract: 'seed-man-locked-v1'
  });
  document.documentElement.dataset.seedManVisualPipeline = SPROUT_VISUAL_PIPELINE;
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
