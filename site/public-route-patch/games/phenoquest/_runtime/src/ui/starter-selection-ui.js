export function renderStarterSelection({ container, starters, onChoose }) {
  if (!container) return;

  container.innerHTML = '';

  const wrapper = document.createElement('div');
  wrapper.className = 'starter-grid';

  for (const starter of starters) {
    const card = document.createElement('button');
    card.type = 'button';
    card.className = 'starter-card';
    card.dataset.starterId = starter.id;
    card.innerHTML = `
      <strong>${starter.displayName}</strong>
      <span>${starter.classes.join(' / ')}</span>
      <small>${starter.description}</small>
    `;
    card.addEventListener('click', () => onChoose?.(starter.id));
    wrapper.appendChild(card);
  }

  container.appendChild(wrapper);
}

export function renderChosenStarter({ container, starterUnit }) {
  if (!container) return;

  container.innerHTML = `
    <div class="result-card">
      <strong>${starterUnit.displayName} joined your team.</strong>
      <span>Trait: ${starterUnit.trait ?? 'unknown'}</span>
      <span>Stability: ${starterUnit.stability}</span>
    </div>
  `;
}
