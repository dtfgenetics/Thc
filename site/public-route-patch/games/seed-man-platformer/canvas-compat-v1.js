'use strict';

/*
 * Sprout Run Canvas2D compatibility layer.
 * Loaded before app.js so the game can request a software-backed 2D context
 * on browsers/devices where GPU-backed Canvas2D can be lost or render blank.
 */
(() => {
  const VERSION = 'sprout-canvas-compat-v1';
  const RELEASE = '20260907-r9';
  const PHENOTYPE_MOBILITY_FRAME_REPAIR = 'seed-man-phenotype-mobility-frame-v1';
  const ENEMY_ATTACK_BROWSER = 'seed-man-enemy-attacks-browser-v1';
  const CAMPAIGN_UI = 'seed-man-campaign-ui-v15';
  const proto = window.HTMLCanvasElement?.prototype;
  const nativeGetContext = proto?.getContext;
  if (!proto || typeof nativeGetContext !== 'function') return;

  let gameContext = null;
  let restored = 0;
  let lost = 0;
  let combatLoadAttempts = 0;
  let combatLoaded = false;
  let mobilityFrameRepairInstalled = false;
  let enemyAttackLoadAttempts = 0;
  let enemyAttacksLoaded = false;
  let campaignUiLoadAttempts = 0;
  let campaignUiLoaded = false;

  function patchedGetContext(type, attributes) {
    if (this.id !== 'game' || type !== '2d') {
      return nativeGetContext.call(this, type, attributes);
    }

    const preferred = {
      ...(attributes || {}),
      alpha: false,
      desynchronized: false,
      willReadFrequently: true,
    };

    try {
      gameContext = nativeGetContext.call(this, type, preferred);
    } catch (error) {
      console.warn('Sprout Run software Canvas2D request failed; retrying default context.', error);
    }

    if (!gameContext) gameContext = nativeGetContext.call(this, type, attributes);
    if (!gameContext) gameContext = nativeGetContext.call(this, type);
    return gameContext;
  }

  proto.getContext = patchedGetContext;

  const redraw = () => {
    window.requestAnimationFrame(() => {
      try {
        if (typeof window.render === 'function') window.render();
      } catch (error) {
        console.warn('Sprout Run redraw after canvas recovery failed.', error);
      }
    });
  };

  function setBrandedCampaignTitle(stageTitle) {
    document.title = stageTitle
      ? `Seed Man: Sprout Run — ${stageTitle} | DTF Genetics`
      : 'Seed Man: Sprout Run | DTF Genetics';
  }

  function installLevelOneSummaryCompatibility() {
    try {
      if (typeof finishGame !== 'function') return;
      const baseFinishGame = finishGame;
      finishGame = function sproutRunCompatibleFinishSummary() {
        baseFinishGame();
        try {
          if (typeof level === 'undefined' || level?.id !== 'sprout-run') return;
          const summary = document.querySelector('#finish-summary');
          if (!summary) return;
          summary.textContent = String(summary.textContent || '').replace(/(\d+)\/(\d+) sprouts/i, '$1 of $2 sprouts');
        } catch (error) {
          console.warn('Sprout Run completion-summary compatibility update failed.', error);
        }
      };
    } catch (error) {
      console.warn('Sprout Run completion-summary compatibility could not install.', error);
    }
  }

  function gameplayBindingsReady() {
    try {
      return typeof stepPlayer === 'function' && typeof render === 'function' && typeof reset === 'function';
    } catch {
      return false;
    }
  }

  function installPhenotypeMobilityFrameRepair() {
    if (mobilityFrameRepairInstalled) return true;
    if (typeof stepPlayer !== 'function' || window.__SPROUT_COMBAT_BROWSER__?.installed !== true) return false;

    const baseCombatStep = stepPlayer;
    stepPlayer = function sproutPhenotypeMobilityFrameStep(inputPlayer, inputState, levelData, dt, config) {
      const next = baseCombatStep(inputPlayer, inputState, levelData, dt, config);
      if (!next || next.finished) return next;

      const combat = window.__SPROUT_COMBAT_BROWSER__?.snapshot?.();
      if (!combat || Number(combat.specialTimer) <= 0 || !combat.activePhenotype) return next;

      const step = Math.max(0, Math.min(Number(dt) || 0, 0.05));
      if (combat.activePhenotype === 'terpene-tempest') {
        const wantsLift = Boolean(inputState?.jumpHeld || inputState?.jumpPressed);
        if (wantsLift) next.vy = Math.max(-360, (Number(next.vy) || 0) - 930 * step);
        else next.vy = Math.min(95, (Number(next.vy) || 0) * 0.7);
        next.grounded = false;
        next.state = wantsLift ? 'phenotype-flight' : 'phenotype-glide';
      } else if (combat.activePhenotype === 'hydro-surge') {
        next.vy = Math.min(120, (Number(next.vy) || 0) * 0.82);
        next.power = next.power || {};
        if (Number(combat.bubbleHits) > 0) {
          next.power.invulnerableTimer = Math.max(Number(next.power.invulnerableTimer) || 0, 0.12);
        }
        if (!next.grounded) next.state = 'phenotype-bubble';
      }
      return next;
    };

    mobilityFrameRepairInstalled = true;
    return true;
  }

  function loadCampaignUiAdapter() {
    if (campaignUiLoaded || document.documentElement.dataset.sproutCampaignUi === CAMPAIGN_UI) {
      campaignUiLoaded = true;
      return;
    }
    if (window.__SPROUT_CAMPAIGN__?.levelCount !== 15 || !window.__SPROUT_CAMPAIGN_EXPERIENCE__) {
      campaignUiLoadAttempts += 1;
      if (campaignUiLoadAttempts <= 80) window.setTimeout(loadCampaignUiAdapter, 25);
      else console.error('Seed Man 15-level campaign UI adapter could not find campaign bindings.');
      return;
    }
    const existing = document.querySelector('script[data-seed-campaign-ui]');
    if (existing) return;
    const script = document.createElement('script');
    script.src = `./campaign-ui-v15.js?v=${RELEASE}`;
    script.async = false;
    script.dataset.seedCampaignUi = 'v15';
    script.addEventListener('load', () => {
      const settle = () => {
        campaignUiLoaded = document.documentElement.dataset.sproutCampaignUi === CAMPAIGN_UI;
        if (!campaignUiLoaded) {
          campaignUiLoadAttempts += 1;
          if (campaignUiLoadAttempts <= 80) window.setTimeout(settle, 25);
          else console.error('Seed Man 15-level campaign UI adapter loaded without installing runtime hooks.');
        }
      };
      settle();
    }, { once: true });
    script.addEventListener('error', () => console.error('Seed Man 15-level campaign UI adapter failed to load.'), { once: true });
    document.body.append(script);
  }

  function loadEnemyAttackBrowserAdapter() {
    if (enemyAttacksLoaded || window.__SPROUT_ENEMY_ATTACKS_BROWSER__?.installed === true) {
      enemyAttacksLoaded = true;
      return;
    }
    if (window.__SPROUT_COMBAT_BROWSER__?.installed !== true || !mobilityFrameRepairInstalled) {
      enemyAttackLoadAttempts += 1;
      if (enemyAttackLoadAttempts <= 80) window.setTimeout(loadEnemyAttackBrowserAdapter, 25);
      else console.error('Seed Man enemy attack adapter could not find combat runtime bindings.');
      return;
    }
    const existing = document.querySelector('script[data-seed-enemy-attacks-browser]');
    if (existing) return;
    const script = document.createElement('script');
    script.src = `./enemy-attacks-browser-v1.js?v=${RELEASE}`;
    script.async = false;
    script.dataset.seedEnemyAttacksBrowser = 'v1';
    script.addEventListener('load', () => {
      const settle = () => {
        enemyAttacksLoaded = window.__SPROUT_ENEMY_ATTACKS_BROWSER__?.installed === true;
        if (!enemyAttacksLoaded) {
          enemyAttackLoadAttempts += 1;
          if (enemyAttackLoadAttempts <= 80) window.setTimeout(settle, 25);
          else console.error('Seed Man enemy attack adapter loaded without installing runtime hooks.');
        }
      };
      settle();
    }, { once: true });
    script.addEventListener('error', () => console.error('Seed Man enemy attack browser adapter failed to load.'), { once: true });
    document.body.append(script);
  }

  function loadCombatBrowserAdapter() {
    if (combatLoaded || window.__SPROUT_COMBAT_BROWSER__?.installed === true) {
      combatLoaded = true;
      if (installPhenotypeMobilityFrameRepair()) loadEnemyAttackBrowserAdapter();
      return;
    }
    if (!gameplayBindingsReady()) {
      combatLoadAttempts += 1;
      if (combatLoadAttempts <= 80) {
        window.setTimeout(loadCombatBrowserAdapter, 25);
      } else {
        console.error('Seed Man combat browser adapter could not find gameplay bindings.');
      }
      return;
    }

    const existing = document.querySelector('script[data-seed-combat-browser]');
    if (existing) return;
    const script = document.createElement('script');
    script.src = `./combat-browser-v1.js?v=${RELEASE}`;
    script.async = false;
    script.dataset.seedCombatBrowser = 'v1';
    script.addEventListener('load', () => {
      combatLoaded = window.__SPROUT_COMBAT_BROWSER__?.installed === true;
      if (!combatLoaded) console.error('Seed Man combat browser adapter loaded without installing runtime hooks.');
      else if (!installPhenotypeMobilityFrameRepair()) console.error('Seed Man phenotype mobility frame repair did not install.');
      else loadEnemyAttackBrowserAdapter();
    }, { once: true });
    script.addEventListener('error', () => console.error('Seed Man combat browser adapter failed to load.'), { once: true });
    document.body.append(script);
  }

  const canvas = document.querySelector('#game');
  if (canvas) {
    canvas.addEventListener('contextlost', () => {
      lost += 1;
      canvas.dataset.contextState = 'lost';
      console.warn('Sprout Run Canvas2D context was lost; waiting for browser restoration.');
    });

    canvas.addEventListener('contextrestored', () => {
      restored += 1;
      canvas.dataset.contextState = 'restored';
      redraw();
    });
  }

  window.addEventListener('pageshow', redraw);
  window.addEventListener('orientationchange', redraw);
  window.addEventListener('resize', redraw, { passive: true });
  window.addEventListener('sprout:level-selected', (event) => {
    const title = event?.detail?.level?.title || event?.detail?.levelId || '';
    queueMicrotask(() => setBrandedCampaignTitle(title));
  });
  window.addEventListener('load', () => {
    setTimeout(() => {
      const active = window.__SPROUT_CAMPAIGN__?.getLevel?.();
      setBrandedCampaignTitle(active?.title || 'Greenhouse Gauntlet');
      installLevelOneSummaryCompatibility();
      loadCampaignUiAdapter();
    }, 0);
  }, { once: true });

  // The compatibility script is the first deferred game script. Do not load
  // combat until app.js and gameplay-v2.js have actually published the classic
  // script bindings that the adapters wrap.
  window.addEventListener('DOMContentLoaded', () => {
    loadCombatBrowserAdapter();
    if (proto.getContext === patchedGetContext) proto.getContext = nativeGetContext;
  }, { once: true });

  window.__SPROUT_CANVAS_COMPAT__ = Object.freeze({
    version: VERSION,
    release: RELEASE,
    phenotypeMobilityFrameRepair: PHENOTYPE_MOBILITY_FRAME_REPAIR,
    enemyAttackBrowser: ENEMY_ATTACK_BROWSER,
    campaignUi: CAMPAIGN_UI,
    softwarePreferred: true,
    campaignTitleBranding: true,
    levelOneSummaryCompatibility: true,
    combatBrowserAutoLoad: true,
    enemyAttackBrowserAutoLoad: true,
    campaignUiAutoLoad: true,
    get combatLoadAttempts() { return combatLoadAttempts; },
    get combatLoaded() { return combatLoaded; },
    get mobilityFrameRepairInstalled() { return mobilityFrameRepairInstalled; },
    get enemyAttackLoadAttempts() { return enemyAttackLoadAttempts; },
    get enemyAttacksLoaded() { return enemyAttacksLoaded; },
    get campaignUiLoadAttempts() { return campaignUiLoadAttempts; },
    get campaignUiLoaded() { return campaignUiLoaded; },
    get contextLostCount() { return lost; },
    get contextRestoredCount() { return restored; },
  });
})();