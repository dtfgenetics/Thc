// Compatibility bootstrap for the Grow Room Defense public route.
// Gameplay rules live in ./engine.mjs and are consumed by ./runtime.mjs.
// Keep this file small so the browser cannot silently drift from the tested engine.
import('./runtime.mjs').catch((error) => {
  console.error('Grow Room Defense canonical runtime failed to load.', error);
  const status = document.querySelector('#load-status');
  if (status) status.textContent = 'Grow Room Defense could not initialize.';
  const announce = document.querySelector('#announce');
  if (announce) announce.textContent = 'Grow Room Defense could not initialize.';
});
