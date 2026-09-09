'use strict';

(() => {
  const images = window.__SEED_MAN_APPROVED_IMAGES__ ||= Object.create(null);
  const version = 'seed-man-approved-art-core-v2';

  // Cacheable files can be decoded and validated independently. The retired
  // inline character sheet was 320×144 while renderers addressed 800×360.
  images['character.seedman.atlas'] = './assets/approved/seed-man-character-atlas-v2.webp';
  images['enemy-boss.atlas'] = './assets/approved/seed-man-enemy-boss-atlas-v1.webp';
  images['platform.atlas'] = './assets/approved/seed-man-platform-atlas-v1.webp';

  window.__SEED_MAN_APPROVED_ART_CORE__ = Object.freeze({ version, images });
  document.documentElement.dataset.seedManApprovedArtCore = 'ready';
})();
