'use strict';

/*
 * Seed Man approved-art renderer.
 * Source of truth: approved 2026-09-08 green armored plant-hero showcase.
 * Gameplay state/collision remain owned by simulation. This file only renders.
 */

const SPROUT_ART_VERSION = 'seed-man-approved-atlas-renderer-v2';
const SPROUT_VISUAL_PIPELINE = 'approved-showcase-2026-09-08';
const SPROUT_CHARACTER_CONTRACT = 'green-armored-plant-hero';

const APPROVED_RECTS = Object.freeze({
  idle:    Object.freeze({ x: 28,  y: 18,  w: 105, h: 156 }),
  run:     Object.freeze({ x: 162, y: 18,  w: 120, h: 156 }),
  jump:    Object.freeze({ x: 315, y: 18,  w: 125, h: 156 }),
  attack:  Object.freeze({ x: 475, y: 18,  w: 145, h: 156 }),
  hurt:    Object.freeze({ x: 640, y: 18,  w: 155, h: 156 }),
  victory: Object.freeze({ x: 26,  y: 196, w: 110, h: 155 }),
  plant:   Object.freeze({ x: 170, y: 196, w: 160, h: 155 }),
  fire:    Object.freeze({ x: 330, y: 196, w: 150, h: 155 }),
  electric:Object.freeze({ x: 478, y: 196, w: 165, h: 155 }),
  ice:     Object.freeze({ x: 638, y: 196, w: 160, h: 155 })
});

let approvedSeedManImage = null;
let approvedSeedManReady = false;
let approvedSeedManFailed = false;

function getApprovedImageSource() {
  return window.__SEED_MAN_APPROVED_IMAGES__?.['character.seedman.atlas'] || '';
}

function ensureApprovedSeedManImage() {
  if (approvedSeedManReady || approvedSeedManFailed) return;
  const src = getApprovedImageSource();
  if (!src) return;
  const image = new Image();
  image.decoding = 'async';
  image.onload = () => {
    approvedSeedManImage = image;
    approvedSeedManReady = true;
    document.documentElement.dataset.seedManRendererOwner = SPROUT_ART_VERSION;
    document.documentElement.dataset.seedManApprovedCharacter = SPROUT_CHARACTER_CONTRACT;
  };
  image.onerror = () => {
    approvedSeedManFailed = true;
    console.error('[Seed Man] approved character atlas failed to load; production fallback is disabled.');
  };
  image.src = src;
}

function combatSnapshot() {
  try { return window.__SPROUT_COMBAT_BROWSER__?.snapshot?.() || null; } catch { return null; }
}

function activeApprovedPhenotype() {
  const id = combatSnapshot()?.activePhenotype || '';
  if (id === 'solar-flare' || id === 'fire') return 'fire';
  if (id === 'static-haze' || id === 'electric') return 'electric';
  if (id === 'frost-resin' || id === 'ice') return 'ice';
  return 'plant';
}

function resolveApprovedPose() {
  if (!player) return 'idle';
  if (player.finished || player.state === 'finish' || player.state === 'victory') return 'victory';
  if (player.state === 'hurt' || player.state === 'shield-bounce') return 'hurt';
  if (player.state === 'attack' || player.state === 'ability') return 'attack';
  if (!player.grounded) return 'jump';
  if (Math.abs(player.vx || 0) > 14) return 'run';
  return 'idle';
}

function chooseApprovedRect() {
  const phenotype = activeApprovedPhenotype();
  const pose = resolveApprovedPose();
  // Power forms are themselves approved full-character drawings. During a powered
  // attack, use the powered character rather than recoloring the base sprite.
  if (phenotype !== 'plant') return APPROVED_RECTS[phenotype];
  if (pose === 'victory') return APPROVED_RECTS.victory;
  return APPROVED_RECTS[pose] || APPROVED_RECTS.idle;
}

function drawApprovedShadow(screenX, screenY) {
  if (!player?.grounded) return;
  ctx.save();
  ctx.globalAlpha = 0.22;
  ctx.fillStyle = '#07120d';
  ctx.beginPath();
  ctx.ellipse(screenX + player.width / 2, screenY + player.height + 3, Math.max(16, player.width * 0.62), 6, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

function drawSeedManProduction() {
  if (!player || !ctx) return;
  ensureApprovedSeedManImage();

  // Production is fail-closed. If the approved atlas has not loaded yet we do
  // not draw a procedural substitute that can silently become the character.
  if (!approvedSeedManReady || !approvedSeedManImage) return;

  const rect = chooseApprovedRect();
  const screenX = player.x - cameraX;
  const screenY = player.y;
  const facing = (player.facing || (player.vx < 0 ? -1 : 1)) < 0 ? -1 : 1;
  const targetHeight = Math.max(70, (player.height || 58) * 1.82);
  const targetWidth = targetHeight * (rect.w / rect.h);
  const centerX = screenX + (player.width || 38) / 2;
  const feetY = screenY + (player.height || 58) + 5;

  drawApprovedShadow(screenX, screenY);

  ctx.save();
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = 'high';
  ctx.translate(centerX, feetY);
  ctx.scale(facing, 1);

  // Tiny motion treatment only; silhouette/art remains exactly the approved atlas.
  const pose = resolveApprovedPose();
  if (pose === 'run') ctx.rotate(Math.sin((performance.now() || 0) * 0.018) * 0.025 * facing);
  if (pose === 'hurt') ctx.globalAlpha = 0.78 + Math.sin((performance.now() || 0) * 0.04) * 0.18;

  ctx.drawImage(
    approvedSeedManImage,
    rect.x, rect.y, rect.w, rect.h,
    -targetWidth / 2, -targetHeight,
    targetWidth, targetHeight
  );
  ctx.restore();
}

window.drawSeedManProduction = drawSeedManProduction;
window.drawSeedMan = drawSeedManProduction;
window.__SEED_MAN_PRODUCTION_ART__ = Object.freeze({
  version: SPROUT_ART_VERSION,
  pipeline: SPROUT_VISUAL_PIPELINE,
  characterContract: SPROUT_CHARACTER_CONTRACT,
  sourceOfTruth: 'approved-showcase-2026-09-08',
  atlasKey: 'character.seedman.atlas',
  fallbackAllowed: false,
  rects: APPROVED_RECTS
});

document.documentElement.dataset.seedManRendererOwner = SPROUT_ART_VERSION;
document.documentElement.dataset.seedManApprovedCharacter = SPROUT_CHARACTER_CONTRACT;
ensureApprovedSeedManImage();
