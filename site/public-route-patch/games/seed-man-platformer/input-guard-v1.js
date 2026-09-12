'use strict';

(() => {
  const VERSION = 'seed-man-input-guard-v20';
  const SHARED_PLATFORM_MODULE = '/games/shared-platform/index.mjs';
  const INTERACTIVE_SELECTOR = 'a, button, input, select, textarea, summary, [contenteditable="true"], [role="button"], [role="link"]';

  function isInteractiveTarget(target) {
    return target instanceof Element && Boolean(target.closest(INTERACTIVE_SELECTOR));
  }

  function protectNativeKeyboardBehavior(event) {
    if (!isInteractiveTarget(event.target)) return;
    event.stopImmediatePropagation();
  }

  window.addEventListener('keydown', protectNativeKeyboardBehavior, { capture:true });
  window.addEventListener('keyup', protectNativeKeyboardBehavior, { capture:true });

  window.__SEED_MAN_INPUT_GUARD__ = Object.freeze({
    version:VERSION,
    campaign:'v20',
    purpose:'protect-native-interactive-keyboard-behavior',
    sharedPlatformConsumer:'seed-man-shared-platform-v1',
    sharedPlatformModule:SHARED_PLATFORM_MODULE,
    sharedPlatformGlobal:'__SPROUT_SHARED_PLATFORM__',
    settingsNamespace:'seed-game-settings',
    legacySignatureRuntime:false
  });

  document.documentElement.dataset.seedManInputGuard = VERSION;
})();
