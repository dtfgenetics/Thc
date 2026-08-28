export function renderCollectionPanel({ container, collection, units }) {
  if (!container) return;

  const entries = Object.values(collection ?? {});
  if (!entries.length) {
    container.innerHTML = '';
    return;
  }

  const rows = entries.map((entry) => {
    const species = units.find((unit) => unit.id === entry.speciesId);
    const name = species?.displayName ?? entry.speciesId;
    return `
      <div class="result-card">
        <strong>${name}</strong>
        <span>Seen: ${entry.seen ? 'yes' : 'no'}</span>
        <span>Battled: ${entry.battled ? 'yes' : 'no'}</span>
        <span>Material: ${entry.materialsOwned}/${entry.materialsRequired}</span>
        <span>Recipe: ${entry.recipeUnlocked ? 'unlocked' : 'locked'}</span>
        <span>Results: ${entry.rootedCount}</span>
        <span>Vault Progress: ${entry.vaultProgress}%</span>
      </div>
    `;
  }).join('');

  container.innerHTML = `
    <section class="collection-panel">
      <h3>PhenoLog Progress</h3>
      ${rows}
    </section>
  `;
}
