// Compatibility bootstrap for the High Life public route.
// Gameplay rules live in ./engine.mjs and are consumed by ./runtime.mjs.
// Keep this file small so the browser can never silently drift from the tested engine.
import('./runtime.mjs').catch((error) => {
  console.error('High Life canonical runtime failed to load.', error);
  const status = document.querySelector('#load-status');
  if (status) status.textContent = 'High Life could not initialize.';
  const announce = document.querySelector('#announce');
  if (announce) announce.textContent = 'High Life could not initialize.';
});
