export function renderLineageLabPanel({
  container,
  previews,
  timers = [],
  getName,
  onStart,
  onRefresh,
  onClaim
}) {
  if (!container) return;

  if (!previews?.length) {
    container.innerHTML = `
      <section class="lineage-lab-panel">
        <h3>Lineage Lab</h3>
        <p class="helper-text">No compatible lineage previews yet. Claim more results in the Vault Garden.</p>
      </section>
    `;
    return;
  }

  const cards = previews.map(({ parentA, parentB, preview }) => {
    const resultNames = preview.resultPool.map((resultId) => getName?.(resultId) ?? resultId).join(', ');
    const markerRows = Object.entries(preview.markerBias ?? {}).map(([marker, value]) => `<span>${marker}: ${value}</span>`).join('');
    const timer = timers.find((candidate) => candidate.pairingRuleId === preview.ruleId) ?? null;
    let actionMarkup = '';

    if (!preview.allowed) {
      actionMarkup = `<p class="helper-text">Unlock ${preview.requiredRank ?? 'the required rank'} and ${preview.requiredRegion ?? 'the required region'} to run this cross.</p>`;
    } else if (!timer) {
      actionMarkup = `<button type="button" data-lineage-start="${preview.ruleId}">Start Cross</button>`;
    } else if (timer.status === 'ready') {
      actionMarkup = `<button type="button" data-lineage-claim="${timer.id}">Claim Offspring</button>`;
    } else {
      actionMarkup = `
        <span>Cross status: ${timer.status}</span>
        <button type="button" data-lineage-refresh="${timer.id}">Refresh Cross</button>
      `;
    }

    return `
      <article class="result-card">
        <strong>${getName?.(parentA.speciesId) ?? parentA.speciesId} x ${getName?.(parentB.speciesId) ?? parentB.speciesId}</strong>
        <span>Status: ${preview.allowed ? 'available' : 'locked'}</span>
        <span>Reason: ${preview.reason}</span>
        <span>Possible Results: ${resultNames}</span>
        <div>${markerRows}</div>
        <div class="lineage-actions">${actionMarkup}</div>
      </article>
    `;
  }).join('');

  container.innerHTML = `
    <section class="lineage-lab-panel">
      <h3>Lineage Lab</h3>
      <p class="helper-text">Compatible rooted lines can be crossed here. Start a batch, let the demo timer finish, then claim the offspring into the Vault Garden.</p>
      ${cards}
    </section>
  `;

  container.querySelectorAll('[data-lineage-start]').forEach((button) => {
    button.addEventListener('click', () => onStart?.(button.dataset.lineageStart));
  });
  container.querySelectorAll('[data-lineage-refresh]').forEach((button) => {
    button.addEventListener('click', () => onRefresh?.(button.dataset.lineageRefresh));
  });
  container.querySelectorAll('[data-lineage-claim]').forEach((button) => {
    button.addEventListener('click', () => onClaim?.(button.dataset.lineageClaim));
  });
}
