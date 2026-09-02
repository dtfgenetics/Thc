const nativeRequestAnimationFrame = window.requestAnimationFrame.bind(window);
const nativeCancelAnimationFrame = window.cancelAnimationFrame.bind(window);

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
const targetFps = softwareWebGL ? 12 : reducedMotion ? 20 : (coarsePointer || lowMemory ? 24 : 40);
const minimumFrameInterval = 1000 / targetFps;

let nextRequestId = 1;
let nativeFrameId = null;
let lastDeliveredAt = 0;
const queuedCallbacks = new Map();

function scheduleNativeFrame() {
  if (nativeFrameId === null && queuedCallbacks.size) nativeFrameId = nativeRequestAnimationFrame(deliverFrame);
}

function deliverFrame(timestamp) {
  nativeFrameId = null;
  if (!queuedCallbacks.size) return;
  if (lastDeliveredAt && timestamp - lastDeliveredAt < minimumFrameInterval) {
    scheduleNativeFrame();
    return;
  }

  lastDeliveredAt = timestamp;
  const callbacks = [...queuedCallbacks.entries()];
  queuedCallbacks.clear();
  callbacks.forEach(([, callback]) => {
    try {
      callback(timestamp);
    } catch (error) {
      queueMicrotask(() => { throw error; });
    }
  });
  scheduleNativeFrame();
}

window.requestAnimationFrame = (callback) => {
  const id = nextRequestId++;
  queuedCallbacks.set(id, callback);
  scheduleNativeFrame();
  return id;
};

window.cancelAnimationFrame = (id) => {
  queuedCallbacks.delete(id);
  if (!queuedCallbacks.size && nativeFrameId !== null) {
    nativeCancelAnimationFrame(nativeFrameId);
    nativeFrameId = null;
  }
};

document.documentElement.dataset.plantAtlasFrameRate = String(targetFps);
document.documentElement.dataset.plantAtlasSoftwareWebgl = softwareWebGL ? 'true' : 'false';
