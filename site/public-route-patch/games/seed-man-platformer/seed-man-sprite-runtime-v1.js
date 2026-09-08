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
    if (!window.player) return 'idle';
    if (player.finished || player.state === 'finish') return 'finish';
    if (player.state === 'hurt' || player.state === 'shield-bounce') return 'hurt';
    if (player.state === 'checkpoint') return 'checkpoint';
    if (player.state === 'boost-bounce' || player.state === 'boss-stomp' || player.state === 'stomp-bounce') return 'boost';
    if (player.state === 'attack' || player.state === 'ability') return 'attack';
    if (!player.grounded) return player.vy < -35 ? 'jump' : 'fall';
    if (Math.abs(player.vx || 0) > 14) return Math.floor(performance.now() / 95) % 2 ? 'runA' : 'runB';
    return 'idle';
  }

  function drawAtlasFrame(frameName) {
    if (!atlasReady || !ctx || !player) return false;
    const frame = frames[frameName] || frames.idle;
    const [column, row] = frame;
    const size = Math.max(72, Math.min(92, player.height * 1.82));
    const centerX = player.x - cameraX + player.width / 2;
    const bottomY = player.y + player.height + 4;
    const facing = player.vx < -1 ? -1 : 1;
    const dx = -size / 2;
    const dy = -size;

    ctx.save();
    ctx.translate(centerX, bottomY);
    ctx.scale(facing, 1);
    if (player.state === 'hurt') {
      ctx.globalAlpha = 0.68 + Math.abs(Math.sin(performance.now() * 0.035)) * 0.3;
    }
    ctx.drawImage(atlas, column * FRAME, row * FRAME, FRAME, FRAME, dx, dy, size, size);
    ctx.restore();
    return true;
  }

  function spriteRenderer() {
    const pheno = phenotypeFrame();
    const currentPose = pose();
    if (drawAtlasFrame(pheno || currentPose)) return;
    fallbackRenderer?.();
  }

  function install() {
    if (installed || typeof window.drawSeedMan !== 'function') return false;
    fallbackRenderer = window.drawSeedMan;
    window.drawSeedMan = spriteRenderer;
    installed = true;
    document.documentElement.dataset.seedManSpriteRuntime = VERSION;
    document.documentElement.dataset.seedManSpriteAtlas = atlasReady ? ATLAS_VERSION : 'loading';
    return true;
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
  window.addEventListener('DOMContentLoaded', () => install(), { once: true });

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
    reinstall: () => {
      installed = false;
      return install();
    }
  });
})();
