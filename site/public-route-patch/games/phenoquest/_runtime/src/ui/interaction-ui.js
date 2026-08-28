function formatTargetName(interaction) {
  if (!interaction || interaction.type === 'none') return 'none';
  return interaction.target?.displayName ?? interaction.target?.id ?? 'unknown';
}

export function renderInteractionControls({ container, onInteract }) {
  if (!container) return;

  container.innerHTML = `
    <section class="interaction-panel result-card">
      <strong>Interaction</strong>
      <span>Face an NPC or object, then press Interact.</span>
      <button type="button" id="interact-button">Interact</button>
    </section>
  `;

  container.querySelector('#interact-button')?.addEventListener('click', () => onInteract?.());
}

export function renderNearbyInteractionHint({ container, interaction, onInteract }) {
  if (!container) return;

  if (!interaction || interaction.type === 'none') {
    renderInteractionControls({ container, onInteract });
    return;
  }

  container.innerHTML = `
    <section class="interaction-panel result-card">
      <strong>Nearby: ${formatTargetName(interaction)}</strong>
      <span>Press Interact, Enter, or Space to talk or inspect.</span>
      <button type="button" id="interact-button">Interact</button>
    </section>
  `;

  container.querySelector('#interact-button')?.addEventListener('click', () => onInteract?.());
}

export function renderInteractionResult({ container, interaction }) {
  if (!container) return;

  if (!interaction || interaction.type === 'none') {
    container.innerHTML = `
      <section class="interaction-panel result-card">
        <strong>Interaction</strong>
        <span>Nothing to interact with here.</span>
        <button type="button" id="interact-button">Interact</button>
      </section>
    `;
    return;
  }

  container.innerHTML = `
    <section class="interaction-panel result-card">
      <strong>Interaction: ${interaction.type}</strong>
      <span>Target: ${formatTargetName(interaction)}</span>
      <span>Dialogue: ${interaction.dialogueId ?? 'none'}</span>
      <button type="button" id="interact-button">Interact Again</button>
    </section>
  `;
}

export function bindInteractionButton({ container, onInteract }) {
  container?.querySelector('#interact-button')?.addEventListener('click', () => onInteract?.());
}
