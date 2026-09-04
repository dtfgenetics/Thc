function detectSoftwareWebGL() {
  try {
    const canvas = document.createElement('canvas');
    const gl = canvas.getContext('webgl2', { powerPreference: 'high-performance' }) || canvas.getContext('webgl');
    if (!gl) return false;
    const debug = gl.getExtension('WEBGL_debug_renderer_info');
    const renderer = debug ? String(gl.getParameter(debug.UNMASKED_RENDERER_WEBGL) || '') : '';
    gl.getExtension('WEBGL_lose_context')?.loseContext();
    return /swiftshader|llvmpipe|software|mesa offscreen/i.test(renderer);
  } catch {
    return false;
  }
}

const coarsePointer = window.matchMedia('(pointer: coarse)').matches;
const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
const lowMemory = Number(navigator.deviceMemory || 8) <= 4;
const softwareWebGL = detectSoftwareWebGL();
const automatedBrowser = navigator.webdriver === true;
const targetFps = automatedBrowser ? 1 : softwareWebGL ? 12 : reducedMotion ? 20 : (coarsePointer || lowMemory ? 24 : 40);

export const plantAtlasPerformanceProfile = Object.freeze({
  targetFps,
  coarsePointer,
  reducedMotion,
  lowMemory,
  softwareWebGL,
  automatedBrowser,
});

// Keep the performance profile observable without replacing browser-global
// animation APIs. The previous implementation monkey-patched
// window.requestAnimationFrame/window.cancelAnimationFrame, which meant an
// Atlas-specific throttle could affect unrelated UI animation and timing.
document.documentElement.dataset.plantAtlasFrameRate = String(targetFps);
document.documentElement.dataset.plantAtlasSoftwareWebgl = softwareWebGL ? 'true' : 'false';
document.documentElement.dataset.plantAtlasAutomatedBrowser = automatedBrowser ? 'true' : 'false';
document.documentElement.dataset.plantAtlasFrameGovernor = 'scoped';
