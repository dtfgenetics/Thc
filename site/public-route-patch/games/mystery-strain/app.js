// Compatibility bootstrap for the Mystery Strain public route.
// Game rules live in ./engine.mjs and are consumed by ./runtime.mjs.
// Keep this file small so the browser cannot silently drift from the tested engine.
import('./runtime.mjs').catch((error) => {
  console.error('Mystery Strain canonical runtime failed to load.', error);
  const status = document.querySelector('#load-status');
  if (status) status.textContent = 'Mystery Strain could not initialize.';
  const announce = document.querySelector('#announce');
  if (announce) announce.textContent = 'Mystery Strain could not initialize.';
});
