'use strict';

(() => {
  const VERSION = 'seed-man-approved-art-runtime-v1';
  const CHARACTER_KEY = 'character.seedman.atlas';
  const FRAME_COLS = 5;
  const FRAME_ROWS = 2;
  const POSES = Object.freeze({
    idle: [0, 0], run: [1, 0], jump: [2, 0], fall: [2, 0],
    attack: [3, 0], ability: [3, 0], hurt: [4, 0], hit: [4, 0],
    finish: [0, 1], victory: [0, 1],
    plant: [1, 1], fire: [2, 1], electric: [3, 1], ice: [4, 1]
  });

  let characterImage = null;
  let ready = false;
  let failed = false;
  let installs = 0;

  function approvedImages() {
    return window.__SEED_MAN_APPROVED_IMAGES__ || null;
  }

  function playerState() {
    try { return typeof player !== 'undefined' ? player : null; } catch { return null; }
  }

  function phenotype() {
    try {
      const id = window.__SPROUT_COMBAT_BROWSER__?.snapshot?.()?.activePhenotype || null;
      if (id === 'solar-flare' || id === 'fire') return 'fire';
      if (id === 'static-haze' || id === 'electric') return 'electric';
      if (id === 'frost-resin' || id === 'ice') return 'ice';
      return null;
    } catch { return null; }
  }

  function pose() {
    const s = playerState();
    if (!s) return 'idle';
    if (s.finished || s.state === 'finish') return 'victory';
    if (s.state === 'hurt' || s.state === 'shield-bounce') return 'hurt';
    if (s.state === 'attack' || s.state === 'ability') return 'attack';
    if (!s.grounded) return Number(s.vy || 0) < -20 ? 'jump' : 'fall';
    if (Math.abs(Number(s.vx || 0)) > 14) return 'run';
    return 'idle';
  }

  function frameName() {
    return phenotype() || pose();
  }

  function drawApprovedSeedMan() {
    const s = playerState();
    if (!ready || !characterImage || !s || typeof ctx === 'undefined' || !ctx) return;

    const name = frameName();
    const [col, row] = POSES[name] || POSES.idle;
    const fw = characterImage.naturalWidth / FRAME_COLS;
    const fh = characterImage.naturalHeight / FRAME_ROWS;
    const camera = typeof cameraX === 'number' ? cameraX : 0;
    const centerX = Number(s.x || 0) - camera + Number(s.width || 34) / 2;
    const feetY = Number(s.y || 0) + Number(s.height || 46) + 5;
    const facing = Number(s.vx || 0) < -1 ? -1 : 1;
    const size = Math.max(86, Math.min(118, Number(s.height || 46) * 2.25));
    const destH = size;
    const destW = size * (fw / fh);

    ctx.save();
    ctx.translate(centerX, feetY);
    ctx.scale(facing, 1);
    if (name === 'hurt') ctx.globalAlpha = 0.7 + Math.abs(Math.sin(performance.now() * 0.03)) * 0.28;
    ctx.drawImage(characterImage, col * fw, row * fh, fw, fh, -destW / 2, -destH, destW, destH);
    ctx.restore();
  }

  function claimRenderer() {
    if (typeof window.drawSeedMan !== 'function' && typeof drawSeedMan !== 'function') return false;
    window.drawSeedMan = drawApprovedSeedMan;
    try { drawSeedMan = drawApprovedSeedMan; } catch {}
    installs += 1;
    document.documentElement.dataset.seedManRendererOwner = VERSION;
    document.documentElement.dataset.seedManCharacterContract = 'green-armored-plant-hero';
    document.documentElement.dataset.seedManApprovedArt = ready ? 'ready' : failed ? 'failed' : 'loading';
    return true;
  }

  function loadCharacter() {
    const src = approvedImages()?.[CHARACTER_KEY];
    if (!src) {
      failed = true;
      document.documentElement.dataset.seedManApprovedArt = 'missing-character';
      console.error(`Seed Man approved art pack is missing ${CHARACTER_KEY}`);
      return;
    }
    const image = new Image();
    image.decoding = 'async';
    image.addEventListener('load', () => {
      characterImage = image;
      ready = true;
      failed = false;
      claimRenderer();
      document.documentElement.dataset.seedManApprovedArt = 'ready';
    }, { once: true });
    image.addEventListener('error', () => {
      failed = true;
      ready = false;
      document.documentElement.dataset.seedManApprovedArt = 'failed';
      console.error('Seed Man approved character atlas failed to decode.');
    }, { once: true });
    image.src = src;
  }

  loadCharacter();
  claimRenderer();
  window.addEventListener('DOMContentLoaded', claimRenderer, { once: true });
  window.addEventListener('load', claimRenderer, { once: true });
  window.addEventListener('sprout:level-selected', claimRenderer);

  window.__SEED_MAN_APPROVED_ART_RUNTIME__ = Object.freeze({
    version: VERSION,
    characterKey: CHARACTER_KEY,
    characterContract: 'green-armored-plant-hero',
    frames: POSES,
    snapshot: () => ({ ready, failed, installs, pose: pose(), phenotype: phenotype(), frame: frameName(), rendererOwner: document.documentElement.dataset.seedManRendererOwner }),
    reinstall: claimRenderer
  });
})();
