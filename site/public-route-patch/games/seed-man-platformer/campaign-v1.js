'use strict';

(() => {
  const VERSION = 'seed-man-campaign-v1-compat-retired';

  // This path is intentionally retained because older cached HTML releases may
  // still request campaign-v1.js. The former implementation installed an
  // obsolete 11-level campaign and registered load-time hooks that competed
  // with the canonical 20-level runtime loaded by world-five-v1.js.
  //
  // Keep this file side-effect free: the v20 runtime owns campaign data,
  // level selection, world state, bosses, progress, and campaign UI.
  document.documentElement.dataset.seedManLegacyCampaign = 'retired';
  window.__SEED_MAN_LEGACY_CAMPAIGN__ = Object.freeze({
    version: VERSION,
    retired: true,
    replacement: 'seed-man-campaign-v20-runtime-v1'
  });
})();
