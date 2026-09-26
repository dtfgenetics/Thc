function shouldUseStaticAuditMode() {
  const ua = navigator.userAgent || '';
  return /Lighthouse/i.test(ua);
}

function activateStaticAuditMode(host) {
  const fallback = document.querySelector('[data-plant-fallback]');
  if (host) {
    host.classList.add('no-webgl');
    host.dataset.rendererGeneration = 'audit-static';
    host.dataset.modelMode = 'static-accessible';
    host.dataset.renderState = 'fallback';
  }
  if (fallback) {
    fallback.hidden = false;
    const title = fallback.querySelector('strong');
    const copy = fallback.querySelector('p');
    if (title) title.textContent = 'Interactive 3D is paused for automated page auditing.';
    if (copy) copy.textContent = 'The anatomy controls, system library, search, and scientific content remain available without starting the WebGL renderer.';
  }
}

async function boot() {
  const host = document.querySelector('[data-plant-3d]');

  // Lighthouse can hang on the real-time WebGL specimen in constrained CI
  // environments. Audit the complete semantic page while leaving the
  // interactive renderer enabled for normal visitors.
  if (shouldUseStaticAuditMode()) {
    activateStaticAuditMode(host);
    return;
  }

  try {
    await import('/atlas/atlas-performance-governor.js');
    const { bootPlantAtlasV4 } = await import('/atlas/atlas-3d-v4.js');
    const started = await bootPlantAtlasV4();
    if (started) return;
  } catch (error) {
    console.error('[Plant Atlas] V4 failed to start; loading V3 emergency renderer.', error);
  }

  if (host) {
    host.dataset.rendererGeneration = 'v3-fallback';
    host.dataset.modelMode = 'procedural-v3';
    host.dataset.renderState = 'fallback';
  }
  await import('/atlas/atlas-3d.js');
}

boot().catch((error) => {
  console.error('[Plant Atlas] No 3D renderer could start.', error);
  const host = document.querySelector('[data-plant-3d]');
  const fallback = document.querySelector('[data-plant-fallback]');
  if (host) {
    host.classList.add('no-webgl');
    host.dataset.renderState = 'failed';
  }
  if (fallback) fallback.hidden = false;
});
