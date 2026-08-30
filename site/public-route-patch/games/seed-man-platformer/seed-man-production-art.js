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
  ctx.beginPath();
  ctx.roundRect(-4.8, -2.6, 10.2, 5.8, 2.8);
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
