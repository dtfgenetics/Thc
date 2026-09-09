'use strict';

(() => {
  const VERSION = 'seed-man-three-compat-fallback-v1';

  // Older page releases still request three-world-v1.js. The generated WebGL
  // bundle is not part of the current public route, so expose an explicit
  // fallback contract instead of producing a 404 and leaving the adapter in
  // an ambiguous state. Approved 2D artwork remains the authoritative render.
  if (!window.SeedManThreeWorld) {
    window.SeedManThreeWorld = Object.freeze({
      version: VERSION,
      rendererVersion: 'approved-2d-art',
      optimizationVersion: 'not-applicable',
      supportsWebGL: () => false,
      createRenderer: () => null
    });
  }

  document.documentElement.dataset.seedThreeWorld = 'approved-2d-fallback';
})();
