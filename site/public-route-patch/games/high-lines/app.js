// Compatibility bootstrap for the High Lines public route.
// Coloring rules live in ./engine.mjs and are consumed by ./runtime.mjs.
// Keep this file small so browser UI cannot silently drift from the tested engine.
import('./runtime.mjs').catch((error) => {
  console.error('High Lines canonical runtime failed to load.', error);
  const status = document.querySelector('#load-status');
  if (status) status.textContent = 'High Lines could not initialize.';
  const announce = document.querySelector('#announce');
  if (announce) announce.textContent = 'High Lines could not initialize.';
});
