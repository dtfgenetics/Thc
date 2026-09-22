// Compatibility bootstrap for the Trichome Trials public route.
// Base judging rules live in ./engine.mjs; UI confidence bonuses live in ./runtime.mjs.
import('./runtime.mjs').catch((error) => {
  console.error('Trichome Trials canonical runtime failed to load.', error);
  const status = document.querySelector('#load-status');
  if (status) status.textContent = 'Trichome Trials could not initialize.';
  const announce = document.querySelector('#announce');
  if (announce) announce.textContent = 'Trichome Trials could not initialize.';
});
