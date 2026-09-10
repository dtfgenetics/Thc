'use strict';

(() => {
  const VERSION = 'seed-man-runtime-health-v20';
  const RELEASE = '20260909-v20-runtime-v5';
  const EXPECTED = Object.freeze({
    campaignLevels: 20,
    campaignUi: 'seed-man-campaign-ui-v20',
    playerState: 'seed-man-player-state-v20',
    combat: 'seed-man-combat-browser-v2',
    enemyAttacks: 'seed-man-enemy-attacks-browser-v2',
    threeApi: 'seed-man-three-public-v3',
    threeRenderer: 'seed-man-three-world-v2',
    approvedArt: 'approved-showcase-2026-09-08'
  });
  const RELEASE_COMPATIBILITY = Object.freeze({
    retiredBootstrapMarker: 'seed-man-runtime-bootstrap-v20',
    declaredDependencies: Object.freeze(['player-state-v20.js','three-world-adapter-v1.js']),
    threeApi: EXPECTED.threeApi,
    behavior: 'metadata-only'
  });

  function snapshot() {
    const campaignLoaded = window.__SPROUT_CAMPAIGN__?.levelCount === EXPECTED.campaignLevels || Boolean(window.__SEED_MAN_CAMPAIGN_V20__);
    const playerStateLoaded = window.__SEED_MAN_PLAYER_STATE__?.installed === true;
    const combatLoaded = window.__SPROUT_COMBAT_BROWSER__?.installed === true;
    const enemyAttacksLoaded = window.__SPROUT_ENEMY_ATTACKS_BROWSER__?.installed === true;
    const campaignUiLoaded = document.documentElement.dataset.sproutCampaignUi === EXPECTED.campaignUi;
    const approvedArtLoaded = Boolean(window.__SEED_MAN_PRODUCTION_ART__ || window.__SEED_MAN_APPROVED_ART_RUNTIME__);
    const threeWorldLoaded = window.__SPROUT_THREE_ADAPTER__?.active === true;
    return Object.freeze({
      campaignLoaded,
      playerStateLoaded,
      combatLoaded,
      enemyAttacksLoaded,
      campaignUiLoaded,
      approvedArtLoaded,
      threeWorldLoaded,
      healthy: campaignLoaded && playerStateLoaded && combatLoaded && enemyAttacksLoaded && approvedArtLoaded
    });
  }

  function syncStatus() {
    const state = snapshot();
    document.documentElement.dataset.seedManRuntimeHealth = state.healthy ? 'ready' : 'degraded';
    document.documentElement.dataset.seedManWorldRenderer = state.threeWorldLoaded ? EXPECTED.threeRenderer : 'seed-man-canvas-world-gradient-v1';
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

  window.__SPROUT_CANVAS_COMPAT__ = Object.freeze({
    version: VERSION,
    release: RELEASE,
    campaignTarget: 20,
    campaignUi: EXPECTED.campaignUi,
    combatRuntime: 'v2',
    playerStateRuntime: 'v20',
    worldRuntime: EXPECTED.threeRenderer,
    approvedArtTarget: EXPECTED.approvedArt,
    releaseCompatibility: RELEASE_COMPATIBILITY,
    legacyDynamicLoader: false,
    legacyCanvasMonkeyPatch: false,
    snapshot,
    syncStatus
  });

  document.documentElement.dataset.seedManRuntimeBridge = VERSION;
  syncStatus();
})();
