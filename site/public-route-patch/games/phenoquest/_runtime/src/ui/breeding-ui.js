export function renderBreedingPanel({ container, preview, parentNames = [], resultNames = [] }) {
  if (!container) return;

  if (!preview) {
    container.innerHTML = `
      <section class="breeding-panel">
        <h3>Lineage Preview</h3>
        <p class="helper-text">Claim more results in the Vault Garden to preview future pairings.</p>
      </section>
    `;
    return;
  }

  const resultList = resultNames.length ? resultNames.join(', ') : preview.resultPool.join(', ');
  const markerRows = Object.entries(preview.markerBias ?? {}).map(([marker, value]) => `
    <span>${marker}: ${value}</span>
  `).join('');

  container.innerHTML = `
    <section class="breeding-panel">
      <h3>Lineage Preview</h3>
      <div class="result-card">
        <strong>${parentNames.join(' x ')}</strong>
        <span>Status: ${preview.allowed ? 'available' : 'locked'}</span>
        <span>Reason: ${preview.reason}</span>
        <span>Possible Result: ${resultList}</span>
        <div>${markerRows}</div>
      </div>
    </section>
  `;
}
