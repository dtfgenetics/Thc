// Compatibility bootstrap for the Root Cause public route.
// Diagnostic game rules live in ./engine.mjs and are consumed by ./runtime.mjs.
// Keep this file small so the browser cannot silently drift from the tested engine.
import('./runtime.mjs').catch((error) => {
  console.error('Root Cause canonical runtime failed to load.', error);
  const status = document.querySelector('#load-status');
  if (status) status.textContent = 'Root Cause could not initialize.';
  const announce = document.querySelector('#announce');
  if (announce) announce.textContent = 'Root Cause could not initialize.';
});
