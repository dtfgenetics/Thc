'use strict';

(() => {
  const VERSION = 'seed-man-runtime-health-open';

  function snapshot() {
    const canvas = document.getElementById('game');
    const appLoaded = Boolean(canvas);
    const campaignLoaded = Boolean(window.__SPROUT_CAMPAIGN__ || window.__SEED_MAN_CAMPAIGN_V20__);
    const playerStateLoaded = Boolean(window.__SEED_MAN_PLAYER_STATE__?.installed);
    const combatLoaded = Boolean(window.__SPROUT_COMBAT_BROWSER__?.installed);
    const enemyAttacksLoaded = Boolean(window.__SPROUT_ENEMY_ATTACKS_BROWSER__?.installed);
    const visualRuntimeLoaded = Boolean(window.__SEED_MAN_PRODUCTION_ART__ || window.__SPROUT_THREE_ADAPTER__ || canvas);
    return Object.freeze({
      appLoaded,
      campaignLoaded,
      playerStateLoaded,
      combatLoaded,
      enemyAttacksLoaded,
      visualRuntimeLoaded,
      healthy: appLoaded && visualRuntimeLoaded
    });
  }

  function syncStatus() {
    const state = snapshot();
    document.documentElement.dataset.seedManRuntimeHealth = state.healthy ? 'ready' : 'degraded';
    const renderer = window.__SEED_MAN_PRODUCTION_ART__?.version || window.__SPROUT_THREE_ADAPTER__?.version || 'canvas';
    document.documentElement.dataset.seedManWorldRenderer = renderer;
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

  window.__SPROUT_CANVAS_COMPAT__ = Object.freeze({
    version: VERSION,
    architectureLocked: false,
    rendererLocked: false,
    campaignLocked: false,
    snapshot,
    syncStatus
  });

  document.documentElement.dataset.seedManRuntimeBridge = VERSION;
  syncStatus();
})();
