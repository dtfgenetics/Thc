'use strict';

(() => {
  const VERSION = 'seed-man-runtime-health-v21';
  const RELEASE = '20260915-v20-world-mechanics-v1';
  const WORLD_MECHANICS_URL = './world-mechanics-browser-v1.js';
  const EXPECTED = Object.freeze({
    campaignLevels: 20,
    campaignUi: 'seed-man-campaign-ui-v20',
    playerState: 'seed-man-player-state-v20',
    combat: 'seed-man-combat-browser-v2',
    enemyAttacks: 'seed-man-enemy-attacks-browser-v2',
    worldMechanics: 'seed-man-world-mechanics-browser-v1',
    threeApi: 'seed-man-three-public-v3',
    threeRenderer: 'seed-man-three-world-v2',
    approvedArt: 'approved-showcase-2026-09-08'
  });
  const RELEASE_COMPATIBILITY = Object.freeze({
    retiredBootstrapMarker: 'seed-man-runtime-bootstrap-v20',
    declaredDependencies: Object.freeze(['player-state-v20.js','three-world-adapter-v1.js','world-mechanics-browser-v1.js']),
    threeApi: EXPECTED.threeApi,
    behavior: 'runtime-health-and-dependency-loader'
  });
  let worldMechanicsLoading = false;

  function ensureWorldMechanics() {
    if (window.__SEED_MAN_WORLD_MECHANICS__?.version === EXPECTED.worldMechanics || worldMechanicsLoading) return;
    worldMechanicsLoading = true;
    const script = document.createElement('script');
    script.src = WORLD_MECHANICS_URL;
    script.async = false;
    script.dataset.seedManWorldMechanicsLoader = 'v1';
    script.onload = () => { worldMechanicsLoading = false; syncStatus(); };
    script.onerror = () => {
      worldMechanicsLoading = false;
      document.documentElement.dataset.seedManWorldMechanics = 'failed';
      console.error('[Seed Man] world-mechanics-browser-v1.js failed to load.');
      syncStatus();
    };
    document.head.appendChild(script);
  }

  function snapshot() {
    const campaignLoaded = window.__SPROUT_CAMPAIGN__?.levelCount === EXPECTED.campaignLevels || Boolean(window.__SEED_MAN_CAMPAIGN_V20__);
    const playerStateLoaded = window.__SEED_MAN_PLAYER_STATE__?.installed === true;
    const combatLoaded = window.__SPROUT_COMBAT_BROWSER__?.installed === true;
    const enemyAttacksLoaded = window.__SPROUT_ENEMY_ATTACKS_BROWSER__?.installed === true;
    const campaignUiLoaded = document.documentElement.dataset.sproutCampaignUi === EXPECTED.campaignUi;
    const approvedArtLoaded = Boolean(window.__SEED_MAN_PRODUCTION_ART__ || window.__SEED_MAN_APPROVED_ART_RUNTIME__);
    const threeWorldLoaded = window.__SPROUT_THREE_ADAPTER__?.active === true;
    const worldMechanicsLoaded = window.__SEED_MAN_WORLD_MECHANICS__?.version === EXPECTED.worldMechanics && window.__SEED_MAN_WORLD_MECHANICS__?.installed?.() === true;
    return Object.freeze({
      campaignLoaded,
      playerStateLoaded,
      combatLoaded,
      enemyAttacksLoaded,
      campaignUiLoaded,
      approvedArtLoaded,
      threeWorldLoaded,
      worldMechanicsLoaded,
      healthy: campaignLoaded && playerStateLoaded && combatLoaded && enemyAttacksLoaded && approvedArtLoaded && worldMechanicsLoaded
    });
  }

  function syncStatus() {
    const state = snapshot();
    document.documentElement.dataset.seedManRuntimeHealth = state.healthy ? 'ready' : 'degraded';
    document.documentElement.dataset.seedManWorldRenderer = state.threeWorldLoaded ? EXPECTED.threeRenderer : 'seed-man-canvas-world-gradient-v1';
    document.documentElement.dataset.seedManWorldMechanicsStatus = state.worldMechanicsLoaded ? 'ready' : worldMechanicsLoading ? 'loading' : 'missing';
    return state;
  }

  function redraw() {
    requestAnimationFrame(() => {
      try {
        if (typeof render === 'function') render();
      } catch {}
      syncStatus();
    });
  }

  window.addEventListener('pageshow', redraw);
  window.addEventListener('orientationchange', redraw);
  window.addEventListener('resize', redraw, { passive:true });
  window.addEventListener('load', syncStatus, { once:true });
  window.addEventListener('sprout:level-selected', syncStatus);
  window.addEventListener('seedman:boss-defeated', syncStatus);
  window.addEventListener('seedman:world-mechanics-ready', syncStatus);

  window.__SPROUT_CANVAS_COMPAT__ = Object.freeze({
    version: VERSION,
    release: RELEASE,
    campaignTarget: 20,
    campaignUi: EXPECTED.campaignUi,
    combatRuntime: 'v2',
    playerStateRuntime: 'v20',
    worldRuntime: EXPECTED.threeRenderer,
    worldMechanicsRuntime: EXPECTED.worldMechanics,
    approvedArtTarget: EXPECTED.approvedArt,
    releaseCompatibility: RELEASE_COMPATIBILITY,
    legacyDynamicLoader: false,
    worldMechanicsDependencyLoader: true,
    legacyCanvasMonkeyPatch: false,
    snapshot,
    syncStatus
  });

  document.documentElement.dataset.seedManRuntimeBridge = VERSION;
  ensureWorldMechanics();
  syncStatus();
})();
