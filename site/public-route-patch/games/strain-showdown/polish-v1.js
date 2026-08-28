const SOUND_PREF_KEY = 'dtf-strain-showdown-sound-v1';

window.addEventListener('DOMContentLoaded', () => {
  const soundButton = document.querySelector('#soundButton');
  const rulesDialog = document.querySelector('#rulesDialog');
  const cancelSelection = document.querySelector('#cancelSelection');

  if (soundButton) {
    const saved = localStorage.getItem(SOUND_PREF_KEY);
    if (saved === 'off' && soundButton.getAttribute('aria-pressed') !== 'false') soundButton.click();
    soundButton.addEventListener('click', () => {
      const enabled = soundButton.getAttribute('aria-pressed') === 'true';
      localStorage.setItem(SOUND_PREF_KEY, enabled ? 'on' : 'off');
    });
  }

  document.addEventListener('keydown', (event) => {
    if (event.key !== 'Escape') return;
    if (rulesDialog?.open) {
      rulesDialog.close();
      return;
    }
    if (cancelSelection && !cancelSelection.hidden) cancelSelection.click();
  });
});
