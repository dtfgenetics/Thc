'use strict';

(() => {
  const version = 'seed-man-approved-art-core-v3';
  const masterUrl = './assets/approved/seed-man-approved-master-atlas-v1.webp';
  const worldOrder = Object.freeze(['greenhouse-valley','forest-ruins','desert-canyon','frozen-peaks','eco-city']);
  const worldAssetKeys = Object.freeze({
    'greenhouse-valley':'world.greenhouse-valley.background',
    'forest-ruins':'world.forest-ruins.background',
    'desert-canyon':'world.desert-canyon.background',
    'frozen-peaks':'world.frozen-peaks.background',
    'eco-city':'world.eco-city.background'
  });
  const worldRegion = Object.freeze({ x:0, y:498, width:1600, height:180 });
  const worldWidth = Math.floor(worldRegion.width / worldOrder.length);

  const images = window.__SEED_MAN_APPROVED_IMAGES__ ||= Object.create(null);
  images['character.seedman.atlas'] = './assets/approved/seed-man-character-atlas-v2.webp';
  images['enemy-boss.atlas'] = './assets/approved/seed-man-enemy-boss-atlas-v1.webp';
  images['platform.atlas'] = './assets/approved/seed-man-platform-atlas-v1.webp';
  images['master.atlas'] = masterUrl;
  images['world.atlas'] = masterUrl;

  const assets = Object.create(null);
  for (const [index, world] of worldOrder.entries()) {
    const key = worldAssetKeys[world];
    assets[key] = Object.freeze({
      key,
      role:'background',
      src:masterUrl,
      region:Object.freeze({ x:worldRegion.x + worldWidth * index, y:worldRegion.y, width:worldWidth, height:worldRegion.height })
    });
  }

  const worldBackground = (worldKey) => assets[worldAssetKeys[worldKey]] || null;
  window.__SEED_MAN_APPROVED_ASSETS__ = Object.freeze(assets);
  window.__SEED_MAN_APPROVED_ART_CORE__ = Object.freeze({
    version,
    sourceOfTruth:'approved-showcase-2026-09-08',
    characterContract:'green-armored-plant-hero',
    masterUrl,
    worldOrder,
    worldAssetKeys,
    worldRegion,
    images,
    assets:window.__SEED_MAN_APPROVED_ASSETS__,
    worldBackground
  });
  document.documentElement.dataset.seedManApprovedArtCore = 'ready';
})();
