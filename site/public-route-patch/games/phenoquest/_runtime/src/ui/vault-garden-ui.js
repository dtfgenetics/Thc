function renderTimerRows(timers = [], title) {
  if (!timers.length) return '';

  const rows = timers.map((timer) => `
    <div class="result-card">
      <strong>${timer.recipeId ?? timer.pairingRuleId}</strong>
      <span>Status: ${timer.status}</span>
      <span>Type: ${timer.type ?? 'result'}</span>
      <span>Weather: ${timer.weatherAtStart ?? 'none'}</span>
      <span>Cue: ${timer.cueAtStart ?? 'none'}</span>
    </div>
  `).join('');

  return `
    <h4>${title}</h4>
    ${rows}
  `;
}

export function renderVaultGardenPanel({ container, vaultGarden }) {
  if (!container) return;

  const rootedUnits = vaultGarden?.rootedUnits ?? [];
  const activeTimers = vaultGarden?.activeTimers ?? [];
  const lineageTimers = vaultGarden?.lineageTimers ?? [];

  const resultRows = rootedUnits.length
    ? rootedUnits.map((unit) => `
      <div class="result-card">
        <strong>${unit.displayName}</strong>
        <span>Trait: ${unit.trait ?? 'unknown'}</span>
        <span>Expression: ${unit.expression ?? 'none'}</span>
        <span>Quality: ${unit.quality}</span>
        <span>Stability: ${unit.stability}</span>
        <span>Keeper: ${unit.isKeeper ? 'yes' : 'no'}</span>
      </div>
    `).join('')
    : '<p class="helper-text">No rooted results yet. Claim a timer result to add one here.</p>';

  container.innerHTML = `
    <section class="vault-garden-panel">
      <h3>Vault Garden</h3>
      ${resultRows}
      ${renderTimerRows(activeTimers, 'Active Result Timers')}
      ${renderTimerRows(lineageTimers, 'Active Lineage Timers')}
    </section>
  `;
}
