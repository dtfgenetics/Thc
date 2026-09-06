'use strict';

(function installSproutRunInputGuard() {
  const interactiveSelector = 'a, button, input, select, textarea, summary, [contenteditable="true"], [role="button"], [role="link"]';

  function isInteractiveTarget(target) {
    return target instanceof Element && Boolean(target.closest(interactiveSelector));
  }

  function protectNativeKeyboardBehavior(event) {
    if (!isInteractiveTarget(event.target)) return;
    event.stopImmediatePropagation();
  }

  function normalizeGeneratedTerminalLanding(selectedLevelId) {
    try {
      if (typeof level === 'undefined' || !level || level.id !== selectedLevelId || Number(level.schemaVersion) < 3) return;
      const worldWidth = Number(level.worldWidth);
      if (!Number.isFinite(worldWidth) || worldWidth <= 0 || !Array.isArray(level.platforms) || !Array.isArray(level.hazards)) return;

      const terminalHazards = level.hazards.filter((hazard) =>
        Number(hazard?.y) === 500 &&
        Number(hazard?.height) === 40 &&
        Number.isFinite(Number(hazard?.x)) &&
        Number.isFinite(Number(hazard?.width)) &&
        Number(hazard.x) + Number(hazard.width) > worldWidth
      );

      for (const hazard of terminalHazards) {
        const hazardX = Number(hazard.x);
        const precedingGround = level.platforms
          .filter((platform) => Number(platform?.y) === 480 && Number(platform?.height) === 60)
          .find((platform) => Math.abs((Number(platform.x) + Number(platform.width)) - hazardX) <= 1);
        if (precedingGround) precedingGround.width = Math.max(Number(precedingGround.width), worldWidth - Number(precedingGround.x));
      }

      if (terminalHazards.length) {
        const removed = new Set(terminalHazards);
        level.hazards = level.hazards.filter((hazard) => !removed.has(hazard));
      }

      for (const platform of level.platforms) {
        const right = Number(platform.x) + Number(platform.width);
        if (right > worldWidth) platform.width = Math.max(1, worldWidth - Number(platform.x));
      }
      for (const hazard of level.hazards) {
        const right = Number(hazard.x) + Number(hazard.width);
        if (right > worldWidth) hazard.width = Math.max(1, worldWidth - Number(hazard.x));
      }
    } catch (error) {
      console.error('Seed Man generated-level safety normalization failed.', error);
    }
  }

  window.addEventListener('keydown', protectNativeKeyboardBehavior, { capture: true });
  window.addEventListener('keyup', protectNativeKeyboardBehavior, { capture: true });
  window.addEventListener('sprout:level-selected', (event) => {
    const levelId = event?.detail?.levelId;
    if (!levelId) return;
    queueMicrotask(() => normalizeGeneratedTerminalLanding(levelId));
  });

  window.__SPROUT_GENERATED_LEVEL_GUARD__ = Object.freeze({
    version: 'seed-man-generated-level-guard-v1',
    normalize: normalizeGeneratedTerminalLanding
  });
})();
