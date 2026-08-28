export function renderRecipePanel({ container, entry, species, activeTimer, onStart, onClaim, onRefresh }) {
  if (!container) return;

  if (!entry || !species) {
    container.innerHTML = '';
    return;
  }

  const ready = activeTimer?.status === 'ready';
  const active = activeTimer?.status === 'active';
  const canStart = entry.materialsOwned >= entry.materialsRequired && !activeTimer;

  container.innerHTML = `
    <div class="result-card">
      <strong>${species.displayName} Recipe</strong>
      <span>Material: ${entry.materialsOwned}/${entry.materialsRequired}</span>
      <span>Status: ${activeTimer?.status ?? (canStart ? 'ready_to_start' : 'needs_material')}</span>
      <button type="button" id="start-recipe-button" ${canStart ? '' : 'disabled'}>Start Timer</button>
      <button type="button" id="check-recipe-button">Check Timer</button>
      <button type="button" id="claim-recipe-button" ${ready ? '' : 'disabled'}>Claim Result</button>
      ${active ? '<small>Timer active. Use Check Timer after the timer duration passes.</small>' : ''}
    </div>
  `;

  container.querySelector('#start-recipe-button')?.addEventListener('click', () => onStart?.());
  container.querySelector('#check-recipe-button')?.addEventListener('click', () => onRefresh?.());
  container.querySelector('#claim-recipe-button')?.addEventListener('click', () => onClaim?.());
}

export function renderRecipeMessage({ container, message }) {
  if (!container) return;
  container.innerHTML = `<div class="result-card"><strong>${message}</strong></div>`;
}
