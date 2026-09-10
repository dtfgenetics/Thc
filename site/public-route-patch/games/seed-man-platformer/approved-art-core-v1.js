'use strict';

(() => {
  const version = 'seed-man-approved-art-core-v4';
  const worldOrder = Object.freeze(['greenhouse-valley','forest-ruins','desert-canyon','frozen-peaks','eco-city']);
  const worldAssetKeys = Object.freeze({
    'greenhouse-valley':'world.greenhouse-valley.background',
    'forest-ruins':'world.forest-ruins.background',
    'desert-canyon':'world.desert-canyon.background',
    'frozen-peaks':'world.frozen-peaks.background',
    'eco-city':'world.eco-city.background'
  });
  const images = window.__SEED_MAN_APPROVED_IMAGES__ ||= Object.create(null);
  images['character.seedman.atlas'] = './assets/approved/seed-man-character-atlas-v2.webp';
  images['enemy-boss.atlas'] = './assets/approved/seed-man-enemy-boss-atlas-v1.webp';
  images['platform.atlas'] = './assets/approved/seed-man-platform-atlas-v1.webp';

  const assets = Object.create(null);
  assets['character.seedman.atlas'] = Object.freeze({key:'character.seedman.atlas',role:'player',src:images['character.seedman.atlas']});
  assets['enemy.atlas'] = Object.freeze({key:'enemy.atlas',role:'enemy',src:images['enemy-boss.atlas']});
  assets['boss.atlas'] = Object.freeze({key:'boss.atlas',role:'boss',src:images['enemy-boss.atlas']});
  assets['platform.atlas'] = Object.freeze({key:'platform.atlas',role:'terrain',src:images['platform.atlas']});
  assets['cover.main'] = Object.freeze({key:'cover.main',role:'cover',renderer:'seed-man-campaign-cover-v1'});
  assets['ui.vfx.cover'] = Object.freeze({key:'ui.vfx.cover',role:'ui-vfx',renderer:'seed-man-canvas-vfx-v2'});
  for (const world of worldOrder) {
    const key = worldAssetKeys[world];
    assets[key] = Object.freeze({
      key,
      role:'background',
      world,
      renderer:'seed-man-three-world-v2',
      fallbackRenderer:'seed-man-canvas-world-gradient-v1'
    });
  }

  const worldBackground = (worldKey) => assets[worldAssetKeys[worldKey]] || null;
  window.__SEED_MAN_APPROVED_ASSETS__ = Object.freeze(assets);
  window.__SEED_MAN_APPROVED_ART_CORE__ = Object.freeze({
    version,
    sourceOfTruth:'approved-showcase-2026-09-08',
    characterContract:'green-armored-plant-hero',
    worldRenderer:'seed-man-three-world-v2',
    worldFallbackRenderer:'seed-man-canvas-world-gradient-v1',
    worldOrder,
    worldAssetKeys,
    images,
    assets:window.__SEED_MAN_APPROVED_ASSETS__,
    worldBackground
  });
  document.documentElement.dataset.seedManApprovedArtCore = 'ready';
})();
