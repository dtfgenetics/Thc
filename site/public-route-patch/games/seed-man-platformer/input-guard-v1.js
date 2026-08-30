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

  window.addEventListener('keydown', protectNativeKeyboardBehavior, { capture: true });
  window.addEventListener('keyup', protectNativeKeyboardBehavior, { capture: true });
})();
