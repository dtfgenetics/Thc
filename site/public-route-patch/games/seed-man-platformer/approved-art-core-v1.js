'use strict';

(() => {
  const version = 'seed-man-art-core-v5';
  const worldOrder = Object.freeze(['greenhouse-valley','forest-ruins','desert-canyon','frozen-peaks','eco-city']);
  const worldAssetKeys = Object.freeze({
    'greenhouse-valley':'world.greenhouse-valley.background',
    'forest-ruins':'world.forest-ruins.background',
    'desert-canyon':'world.desert-canyon.background',
    'frozen-peaks':'world.frozen-peaks.background',
    'eco-city':'world.eco-city.background'
  });
  const worldSources = Object.freeze({
    'greenhouse-valley':'./assets/worlds/greenhouse-valley-bg-v1.png',
    'forest-ruins':'./assets/worlds/forest-ruins-bg-v1.png',
    'desert-canyon':'./assets/worlds/desert-canyon-bg-v1.png',
    'frozen-peaks':'./assets/worlds/frozen-peaks-bg-v1.png',
    'eco-city':'./assets/worlds/eco-city-bg-v1.png'
  });
  const images = window.__SEED_MAN_APPROVED_IMAGES__ ||= Object.create(null);
  images['character.seedman.atlas'] = './assets/approved/seed-man-character-atlas-v2.webp';
  images['enemy-boss.atlas'] = './assets/approved/seed-man-enemy-boss-atlas-v1.webp';
  images['platform.atlas'] = './assets/approved/seed-man-platform-atlas-v1.webp';

  const assets = Object.create(null);
  assets['character.seedman.atlas'] = Object.freeze({
    key:'character.seedman.atlas',
    role:'player',
    src:images['character.seedman.atlas'],
    status:'temporary-legacy-replacement-pending',
    characterReference:'green-armored-plant-hero',
    targetCharacterReference:'classic-seed-man-oval-v1'
  });
  assets['enemy.atlas'] = Object.freeze({key:'enemy.atlas',role:'enemy',src:images['enemy-boss.atlas'],status:'temporary-shared-frames'});
  assets['boss.atlas'] = Object.freeze({key:'boss.atlas',role:'boss',src:images['enemy-boss.atlas'],status:'temporary-shared-frames'});
  assets['platform.atlas'] = Object.freeze({key:'platform.atlas',role:'terrain',src:images['platform.atlas'],status:'temporary'});
  assets['cover.main'] = Object.freeze({key:'cover.main',role:'cover',renderer:'seed-man-campaign-cover-v1'});
  assets['ui.vfx.cover'] = Object.freeze({key:'ui.vfx.cover',role:'ui-vfx',renderer:'seed-man-canvas-vfx-v2'});
  for (const world of worldOrder) {
    const key = worldAssetKeys[world];
    const src = worldSources[world];
    images[key] = src;
    assets[key] = Object.freeze({
      key,
      role:'background',
      world,
      src,
      renderer:'seed-man-authored-flat-background-v1',
      fallbackRenderer:'seed-man-canvas-world-gradient-v1',
      temporaryFlattened:true,
      finalLayerTarget:7
    });
  }

  const worldBackground = (worldKey) => assets[worldAssetKeys[worldKey]] || null;
  window.__SEED_MAN_APPROVED_ASSETS__ = Object.freeze(assets);
  window.__SEED_MAN_APPROVED_ART_CORE__ = Object.freeze({
    version,
    sourceOfTruth:'classic-seed-man-oval-v1',
    characterContract:'classic-seed-man-oval-v1',
    currentCharacterAssetStatus:'temporary-green-armored-replacement-pending',
    worldRendererTarget:'seed-man-three-world-v2',
    activeWorldRenderer:'seed-man-authored-flat-background-v1',
    worldFallbackRenderer:'seed-man-canvas-world-gradient-v1',
    finalWorldLayerTarget:7,
    worldOrder,
    worldAssetKeys,
    worldSources,
    images,
    assets:window.__SEED_MAN_APPROVED_ASSETS__,
    worldBackground
  });
  document.documentElement.dataset.seedManApprovedArtCore = 'transition-v5';
  document.documentElement.dataset.seedManCharacterTarget = 'classic-seed-man-oval-v1';
  document.documentElement.dataset.seedManCharacterArtStatus = 'replacement-pending';
})();