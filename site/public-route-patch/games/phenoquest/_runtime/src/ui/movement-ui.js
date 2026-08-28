export function renderMovementControls({ container, onMove }) {
  if (!container) return;

  container.innerHTML = `
    <div class="movement-controls" aria-label="Movement controls">
      <button type="button" data-dir="up">Up</button>
      <div>
        <button type="button" data-dir="left">Left</button>
        <button type="button" data-dir="down">Down</button>
        <button type="button" data-dir="right">Right</button>
      </div>
    </div>
  `;

  container.querySelectorAll('[data-dir]').forEach((button) => {
    button.addEventListener('click', () => onMove?.(button.dataset.dir));
  });
}
