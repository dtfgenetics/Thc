(() => {
  'use strict';

  const tools = document.querySelector('#tools');
  const lanes = document.querySelector('#lanes');
  if (!tools || !lanes) return;

  const mobileTouchLayout = window.matchMedia('(max-width: 980px) and (pointer: coarse)');
  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');

  tools.addEventListener('click', (event) => {
    const button = event.target.closest('button[data-tool]');
    if (!button || button.disabled || !mobileTouchLayout.matches) return;

    window.requestAnimationFrame(() => {
      lanes.scrollIntoView({
        behavior: reducedMotion.matches ? 'auto' : 'smooth',
        block: 'start'
      });
    });
  });
})();
