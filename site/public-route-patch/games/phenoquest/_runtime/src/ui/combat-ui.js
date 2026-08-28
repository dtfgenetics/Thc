function formatStatuses(combatant) {
  const statuses = combatant.statuses ?? [];
  if (!statuses.length) return 'none';
  return statuses.map((status) => `${status.id} (${status.duration})`).join(', ');
}

export function renderCombatPanel({ container, player, opponent, log = '', actions = [], onAction }) {
  if (!container) return;

  if (!player || !opponent) {
    container.innerHTML = '';
    return;
  }

  const actionButtons = actions.map((action) => `
    <button type="button" data-action-id="${action.id}">
      ${action.displayName}
    </button>
  `).join('');

  container.innerHTML = `
    <div class="combat-panel">
      <div class="combat-row">
        <div class="combat-card">
          <strong>${player.displayName}</strong>
          <span>Vigor: ${player.vigor}/${player.maxVigor}</span>
          <span>Stability: ${player.stability}</span>
          <span>Status: ${formatStatuses(player)}</span>
        </div>
        <div class="combat-card">
          <strong>${opponent.displayName}</strong>
          <span>Vigor: ${opponent.vigor}/${opponent.maxVigor}</span>
          <span>Stability: ${opponent.stability}</span>
          <span>Status: ${formatStatuses(opponent)}</span>
        </div>
      </div>
      <div class="action-row">${actionButtons}</div>
      <pre class="combat-log">${log}</pre>
    </div>
  `;

  container.querySelectorAll('[data-action-id]').forEach((button) => {
    button.addEventListener('click', () => onAction?.(button.dataset.actionId));
  });
}

export function renderCombatResult({ container, message }) {
  if (!container) return;

  container.innerHTML = `
    <div class="result-card">
      <strong>${message}</strong>
    </div>
  `;
}
