'use strict';

(() => {
  const VERSION = 'seed-man-sprite-runtime-v1';
  const ATLAS_VERSION = 'seed-man-authored-atlas-v1';
  const FRAME = 256;
  const ATLAS_URL = './assets/seed-man/seed-man-atlas-v1.svg';
  const frames = Object.freeze({
    idle: [0, 0],
    runA: [1, 0],
    runB: [2, 0],
    jump: [3, 0],
    fall: [3, 0],
    boost: [3, 0],
    attack: [4, 0],
    hurt: [0, 0],
    checkpoint: [0, 0],
    finish: [5, 0],
    fire: [0, 1],
    electric: [1, 1],
    ice: [2, 1]
  });

  const atlas = new Image();
  let atlasReady = false;
  let atlasFailed = false;
  let installed = false;
  let fallbackRenderer = null;

  function playerState() {
    try { return typeof player !== 'undefined' ? player : null; }
    catch { return null; }
  }

  function activePhenotype() {
    try { return window.__SPROUT_COMBAT_BROWSER__?.snapshot?.()?.activePhenotype || null; }
    catch { return null; }
  }

  function phenotypeFrame() {
    const id = activePhenotype();
    if (id === 'solar-flare') return 'fire';
    if (id === 'static-haze') return 'electric';
    if (id === 'frost-resin') return 'ice';
    return null;
  }

  function pose() {
    const state = playerState();
    if (!state) return 'idle';
    if (state.finished || state.state === 'finish') return 'finish';
    if (state.state === 'hurt' || state.state === 'shield-bounce') return 'hurt';
    if (state.state === 'checkpoint') return 'checkpoint';
    if (state.state === 'boost-bounce' || state.state === 'boss-stomp' || state.state === 'stomp-bounce') return 'boost';
    if (state.state === 'attack' || state.state === 'ability') return 'attack';
    if (!state.grounded) return state.vy < -35 ? 'jump' : 'fall';
    if (Math.abs(state.vx || 0) > 14) return Math.floor(performance.now() / 95) % 2 ? 'runA' : 'runB';
    return 'idle';
  }

  function drawAtlasFrame(frameName) {
    const state = playerState();
    if (!atlasReady || !state || typeof ctx === 'undefined' || !ctx) return false;
    const frame = frames[frameName] || frames.idle;
    const [column, row] = frame;
    const size = Math.max(72, Math.min(92, state.height * 1.82));
    const localCameraX = typeof cameraX === 'number' ? cameraX : 0;
    const centerX = state.x - localCameraX + state.width / 2;
    const bottomY = state.y + state.height + 4;
    const facing = state.vx < -1 ? -1 : 1;

    ctx.save();
    ctx.translate(centerX, bottomY);
    ctx.scale(facing, 1);
    if (state.state === 'hurt') {
      ctx.globalAlpha = 0.68 + Math.abs(Math.sin(performance.now() * 0.035)) * 0.3;
    }
    ctx.drawImage(atlas, column * FRAME, row * FRAME, FRAME, FRAME, -size / 2, -size, size, size);
    ctx.restore();
    return true;
  }

  function spriteRenderer() {
    if (drawAtlasFrame(phenotypeFrame() || pose())) return;
    fallbackRenderer?.();
  }

  function install({ force = false } = {}) {
    if (typeof window.drawSeedMan !== 'function') return false;
    if (!fallbackRenderer && window.drawSeedMan !== spriteRenderer) fallbackRenderer = window.drawSeedMan;
    if (installed && !force && window.drawSeedMan === spriteRenderer) return true;
    window.drawSeedMan = spriteRenderer;
    installed = true;
    document.documentElement.dataset.seedManSpriteRuntime = VERSION;
    document.documentElement.dataset.seedManSpriteAtlas = atlasReady ? ATLAS_VERSION : atlasFailed ? 'fallback' : 'loading';
    document.documentElement.dataset.seedManRendererOwner = VERSION;
    return window.drawSeedMan === spriteRenderer;
  }

  atlas.addEventListener('load', () => {
    atlasReady = true;
    atlasFailed = false;
    document.documentElement.dataset.seedManSpriteAtlas = ATLAS_VERSION;
  }, { once: true });
  atlas.addEventListener('error', () => {
    atlasFailed = true;
    atlasReady = false;
    document.documentElement.dataset.seedManSpriteAtlas = 'fallback';
  }, { once: true });
  atlas.decoding = 'async';
  atlas.src = ATLAS_URL;

  install();
  window.addEventListener('DOMContentLoaded', () => install({ force: true }), { once: true });

  window.__SPROUT_SPRITE_RUNTIME__ = Object.freeze({
    version: VERSION,
    atlasVersion: ATLAS_VERSION,
    atlasUrl: ATLAS_URL,
    frames,
    snapshot: () => ({
      installed,
      atlasReady,
      atlasFailed,
      atlasVersion: atlasReady ? ATLAS_VERSION : null,
      pose: pose(),
      phenotypeFrame: phenotypeFrame(),
      rendererOwner: window.drawSeedMan === spriteRenderer ? VERSION : 'other'
    }),
    reinstall: () => install({ force: true })
  });
})();
