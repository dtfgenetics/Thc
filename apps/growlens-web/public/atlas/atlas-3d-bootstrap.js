async function boot() {
  const host = document.querySelector('[data-plant-3d]');
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
