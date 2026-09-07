window.addEventListener('DOMContentLoaded', () => {
  const battleScreen = document.querySelector('#battleScreen');
  const hand = document.querySelector('#hand');
  const playerLanes = document.querySelector('#playerLanes');
  const endTurn = document.querySelector('#endTurnButton');
  const selectionHint = document.querySelector('#selectionHint');
  if (!battleScreen || !hand || !playerLanes || !endTurn || !selectionHint) return;

  const tactical = document.createElement('div');
  tactical.className = 'tactical-strip';
  tactical.id = 'tacticalStrip';
  tactical.setAttribute('role', 'status');
  tactical.setAttribute('aria-live', 'polite');
  battleScreen.insertBefore(tactical, battleScreen.querySelector('.hand-panel'));

  function decorateHand() {
    [...hand.querySelectorAll('.card[data-hand-index]')].forEach((card, index) => {
      if (index >= 9) return;
      const shortcut = String(index + 1);
      card.setAttribute('aria-keyshortcuts', shortcut);
      let badge = card.querySelector('.hand-shortcut');
      if (!badge) {
        badge = document.createElement('kbd');
        badge.className = 'hand-shortcut';
        card.append(badge);
      }
      badge.textContent = shortcut;
    });
  }

  function updateTacticalStrip() {
    const focus = document.querySelector('#playerFocus')?.textContent || 'Focus —';
    const selected = hand.querySelector('.card.selected');
    const playableCount = hand.querySelectorAll('.card:not(.unplayable)').length;
    const attackCount = playerLanes.querySelectorAll('.attack-button:not(:disabled)').length;
    const validLanes = playerLanes.querySelectorAll('.lane.valid-target').length;
    const turn = document.querySelector('#turnBadge')?.textContent?.trim() || 'TURN';

    tactical.innerHTML = `
      <span class="tactical-turn">${turn}</span>
      <strong>${focus}</strong>
      <span>${playableCount} playable card${playableCount === 1 ? '' : 's'}</span>
      <span>${attackCount} ready attack${attackCount === 1 ? '' : 's'}</span>
      ${selected ? `<span>${validLanes} valid lane${validLanes === 1 ? '' : 's'}</span>` : '<span>1–9 selects hand · A/S/D attacks lanes · E ends turn</span>'}
    `;
  }

  function refresh() {
    decorateHand();
    updateTacticalStrip();
  }

  document.addEventListener('keydown', (event) => {
    if (event.altKey || event.ctrlKey || event.metaKey || event.defaultPrevented) return;
    const target = event.target;
    if (target instanceof HTMLInputElement || target instanceof HTMLTextAreaElement || target instanceof HTMLSelectElement) return;
    if (battleScreen.hidden) return;

    if (/^[1-9]$/.test(event.key)) {
      const card = hand.querySelector(`.card[data-hand-index="${Number(event.key) - 1}"]`);
      if (card && card.getAttribute('aria-disabled') !== 'true') {
        event.preventDefault();
        card.click();
      }
      return;
    }

    const laneKeys = { a: 0, s: 1, d: 2 };
    const lane = laneKeys[event.key.toLowerCase()];
    if (lane !== undefined) {
      const attack = playerLanes.querySelector(`[data-attack-lane="${lane}"]:not(:disabled)`);
      if (attack) {
        event.preventDefault();
        attack.click();
        return;
      }
      const targetLane = playerLanes.querySelector(`.lane.valid-target[data-lane="${lane}"]`);
      if (targetLane) {
        event.preventDefault();
        targetLane.click();
      }
      return;
    }

    if (event.key.toLowerCase() === 'e' && !endTurn.disabled) {
      event.preventDefault();
      endTurn.click();
    }
  });

  const observer = new MutationObserver(refresh);
  observer.observe(battleScreen, { subtree: true, childList: true, attributes: true, attributeFilter: ['hidden', 'disabled', 'class'] });
  refresh();
});
