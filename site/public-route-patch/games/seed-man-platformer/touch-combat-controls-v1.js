'use strict';

(() => {
  const VERSION = 'seed-man-touch-combat-controls-v1';
  const attackButton = document.querySelector('#combat-attack-button');
  const abilityButton = document.querySelector('#combat-ability-button');
  const canvas = document.querySelector('#game');
  const bindings = [];

  function combatApi() {
    return window.__SPROUT_COMBAT_BROWSER__ || null;
  }

  function refocusGame() {
    if (!canvas) return;
    try { canvas.focus({ preventScroll: true }); }
    catch { canvas.focus(); }
  }

  function flash(button, result) {
    if (!button) return;
    button.dataset.combatFeedback = result === false ? 'blocked' : 'fired';
    window.setTimeout(() => {
      delete button.dataset.combatFeedback;
    }, 150);
  }

  function bind(button, method) {
    if (!button) return false;
    const activate = (event) => {
      event.preventDefault();
      if (button.disabled) return;
      const api = combatApi();
      const action = api?.[method];
      if (typeof action !== 'function') {
        console.warn(`[Seed Man] ${method} is unavailable; combat runtime is not ready.`);
        flash(button, false);
        return;
      }
      const result = action.call(api);
      flash(button, result);
      refocusGame();
    };
    button.addEventListener('click', activate);
    bindings.push({ button, activate, method });
    return true;
  }

  const attackBound = bind(attackButton, 'fireWeapon');
  const abilityBound = bind(abilityButton, 'fireAbility');

  document.documentElement.dataset.seedTouchCombat = attackBound && abilityBound ? 'ready' : 'partial';
  window.__SEED_MAN_TOUCH_COMBAT__ = Object.freeze({
    version: VERSION,
    attackBound,
    abilityBound,
    snapshot: () => ({
      version: VERSION,
      attackBound,
      abilityBound,
      combatReady: Boolean(combatApi()?.installed)
    })
  });
})();
