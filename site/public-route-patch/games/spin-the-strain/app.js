// Compatibility bootstrap for the Spin the Strain public route.
// Deterministic wheel rules live in ./engine.mjs and are consumed by ./runtime.mjs.
import('./runtime.mjs').catch((error) => {
  console.error('Spin the Strain canonical runtime failed to load.', error);
  const status = document.querySelector('#load-status');
  if (status) status.textContent = 'Spin the Strain could not initialize.';
  const announce = document.querySelector('#announce');
  if (announce) announce.textContent = 'Spin the Strain could not initialize.';
});
