// Compatibility bootstrap for the Harvest Hustle public route.
// Gameplay rules live in ./engine.mjs and are consumed by ./runtime.mjs.
// Keep this file small so the browser cannot silently drift from the tested engine.
import('./runtime.mjs').catch((error) => {
  console.error('Harvest Hustle canonical runtime failed to load.', error);
  const status = document.querySelector('#load-status');
  if (status) status.textContent = 'Harvest Hustle could not initialize.';
  const announce = document.querySelector('#announce');
  if (announce) announce.textContent = 'Harvest Hustle could not initialize.';
});
