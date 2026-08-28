export function renderEncounterControls({ container, onRoll }) {
  if (!container) return;

  container.innerHTML = `
    <div class="encounter-controls">
      <button type="button" id="roll-encounter-button">Roll Field Encounter</button>
      <p class="helper-text">Prototype trigger for testing the encounter table.</p>
    </div>
  `;

  container.querySelector('#roll-encounter-button')?.addEventListener('click', () => onRoll?.());
}

export function renderEncounterResult({ container, encounter, species, level, expression }) {
  if (!container) return;

  if (!encounter || !species) {
    container.innerHTML = `<div class="result-card"><strong>No eligible encounter found.</strong></div>`;
    return;
  }

  container.innerHTML = `
    <div class="result-card">
      <strong>Encounter: ${species.displayName}</strong>
      <span>Level: ${level}</span>
      <span>Classes: ${species.classes.join(' / ')}</span>
      <span>Expression: ${expression?.displayName ?? 'None'}</span>
    </div>
  `;
}
