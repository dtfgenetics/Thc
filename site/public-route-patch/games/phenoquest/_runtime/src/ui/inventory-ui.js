export function renderInventoryPanel({ container, inventory }) {
  if (!container) return;

  const materials = inventory?.materials ?? [];
  const items = inventory?.items ?? [];

  const materialRows = materials.length
    ? materials.map((material) => `
      <div class="inventory-row">
        <strong>${material.speciesId}</strong>
        <span>Count: ${material.count}</span>
        <span>Tags: ${(material.tags ?? []).join(', ') || 'none'}</span>
      </div>
    `).join('')
    : '<p class="helper-text">No field material yet.</p>';

  const itemRows = items.length
    ? items.map((item) => `
      <div class="inventory-row">
        <strong>${item.itemId}</strong>
        <span>Count: ${item.count}</span>
      </div>
    `).join('')
    : '<p class="helper-text">No items yet.</p>';

  container.innerHTML = `
    <section class="inventory-panel">
      <h3>Inventory</h3>
      <h4>Field Material</h4>
      ${materialRows}
      <h4>Items</h4>
      ${itemRows}
    </section>
  `;
}
