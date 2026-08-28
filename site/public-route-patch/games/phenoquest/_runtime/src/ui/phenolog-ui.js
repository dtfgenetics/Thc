export function renderPhenoLogPanel({ container, collection, units }) {
  if (!container) return;

  const entries = Object.values(collection ?? {});

  if (!entries.length) {
    container.innerHTML = `
      <section class="phenolog-panel">
        <h3>PhenoLog</h3>
        <p class="helper-text">No entries discovered yet.</p>
      </section>
    `;
    return;
  }

  const cards = entries.map((entry) => {
    const species = units.find((unit) => unit.id === entry.speciesId);
    return `
      <article class="result-card">
        <strong>${species?.displayName ?? entry.speciesId}</strong>
        <span>Seen: ${entry.seen ? 'yes' : 'no'}</span>
        <span>Battled: ${entry.battled ? 'yes' : 'no'}</span>
        <span>Material: ${entry.materialsOwned}/${entry.materialsRequired}</span>
        <span>Recipe: ${entry.recipeUnlocked ? 'unlocked' : 'locked'}</span>
        <span>Results Rooted: ${entry.rootedCount}</span>
        <span>Traits: ${(entry.knownTraits ?? []).join(', ') || 'unknown'}</span>
        <span>Expressions: ${(entry.knownExpressions ?? []).join(', ') || 'unknown'}</span>
        <span>Keeper Found: ${entry.keeperFound ? 'yes' : 'no'}</span>
        <span>Vault Progress: ${entry.vaultProgress}%</span>
      </article>
    `;
  }).join('');

  container.innerHTML = `
    <section class="phenolog-panel">
      <h3>PhenoLog</h3>
      ${cards}
    </section>
  `;
}
