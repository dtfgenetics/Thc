'use strict';

(() => {
  const VERSION = 'grow-room-defense-accessibility-v1';
  const lanes = document.querySelector('#lanes');
  const tools = document.querySelector('#tools');
  const announce = document.querySelector('#announce');
  if (!lanes || !tools) return;

  const mobileTouchLayout = window.matchMedia('(max-width: 980px) and (pointer: coarse)');
  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');

  function enhanceHealthMeters() {
    for (const track of lanes.querySelectorAll('.health-track')) {
      const heading = track.closest('.lane-card')?.querySelector('.lane-heading');
      const plant = heading?.querySelector('strong')?.textContent?.trim() || 'Plant bench';
      const rawHealth = heading?.querySelector('b')?.textContent || '0';
      const health = Math.max(0, Math.min(100, Number.parseInt(rawHealth, 10) || 0));
      track.setAttribute('role', 'progressbar');
      track.setAttribute('aria-label', `${plant} health`);
      track.setAttribute('aria-valuemin', '0');
      track.setAttribute('aria-valuemax', '100');
      track.setAttribute('aria-valuenow', String(health));
      track.setAttribute('aria-valuetext', `${health} percent health`);
    }
  }

  function enhanceToolShortcuts() {
    const buttons = [...tools.querySelectorAll('button[data-tool]')];
    buttons.forEach((button, index) => {
      const key = String(index + 1);
      button.setAttribute('aria-keyshortcuts', key);
      button.dataset.shortcut = key;
      const label = button.querySelector('strong')?.textContent?.trim() || 'IPM tool';
      button.title = `${label} · shortcut ${key}`;
      if (!button.querySelector('.tool-shortcut')) {
        const badge = document.createElement('kbd');
        badge.className = 'tool-shortcut';
        badge.textContent = key;
        badge.setAttribute('aria-hidden', 'true');
        button.append(badge);
      }
    });
  }

  function enhance() {
    enhanceHealthMeters();
    enhanceToolShortcuts();
  }

  function isTypingTarget(target) {
    return target instanceof HTMLElement && Boolean(target.closest('input, textarea, select, [contenteditable="true"]'));
  }

  function returnToBenchesAfterTouchToolSelection(event) {
    const button = event.target.closest?.('button[data-tool]');
    if (!button || button.disabled || !mobileTouchLayout.matches || event.detail === 0) return;

    window.requestAnimationFrame(() => {
      lanes.scrollIntoView({
        behavior: reducedMotion.matches ? 'auto' : 'smooth',
        block: 'start'
      });
    });
  }

  tools.addEventListener('click', returnToBenchesAfterTouchToolSelection);

  window.addEventListener('keydown', (event) => {
    if (event.defaultPrevented || event.altKey || event.ctrlKey || event.metaKey || isTypingTarget(event.target)) return;
    if (!/^[1-7]$/.test(event.key)) return;
    const button = tools.querySelector(`button[data-tool]:nth-of-type(${event.key})`);
    if (!button || button.disabled) return;
    event.preventDefault();
    button.click();
    const label = button.querySelector('strong')?.textContent?.trim() || 'IPM tool';
    if (announce) announce.textContent = `${label} selected with shortcut ${event.key}. Choose a threat or plant bench.`;
    button.focus({ preventScroll: true });
  });

  const observer = new MutationObserver((records) => {
    if (!records.some((record) => record.type === 'childList')) return;
    enhance();
  });
  observer.observe(lanes, { childList: true, subtree: true });
  observer.observe(tools, { childList: true, subtree: true });

  enhance();
  window.__GROW_ROOM_DEFENSE_ACCESSIBILITY__ = Object.freeze({
    version: VERSION,
    toolShortcuts: '1-7',
    semanticHealthMeters: true,
    mobileToolReturn: true,
    refresh: enhance
  });
})();