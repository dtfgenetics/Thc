'use strict';

(() => {
  const VERSION = 'seed-man-three-adapter-v2';
  const EXPECTED_API_VERSION = 'seed-man-three-public-v2';
  const EXPECTED_RENDERER_VERSION = 'seed-man-three-world-v2';
  const EXPECTED_OPTIMIZATION = 'seed-man-three-instancing-v1';
  const gameCanvas = document.querySelector('#game');
  const shell = document.querySelector('.game-shell');
  const api = window.SeedManThreeWorld;

  if (!gameCanvas || !shell || !api?.supportsWebGL?.() || typeof api.createRenderer !== 'function') {
    document.documentElement.dataset.seedThreeWorld = 'fallback';
    return;
  }

  let renderer = null;
  let threeCanvas = null;
  let stack = null;
  let mountedLevelId = null;
  let disposed = false;
  let frameId = 0;
  let resizeObserver = null;
  let lastWidth = 0;
  let lastHeight = 0;
  let resizeDirty = true;
  let pageVisible = !document.hidden;
  let selectedPixelRatio = 1;
  let renderStats = null;
  const originalDrawBackground = window.drawBackground;
  const originalDrawPlatforms = window.drawPlatforms;
  const originalDrawCheckpoints = window.drawCheckpoints;
  const originalDrawFinish = window.drawFinish;

  function currentLevel() {
    try { return typeof level !== 'undefined' ? level : null; } catch { return null; }
  }

  function currentPlayer() {
    try { return typeof player !== 'undefined' ? player : null; } catch { return null; }
  }

  function currentCameraX() {
    try { return typeof cameraX !== 'undefined' ? cameraX : 0; } catch { return 0; }
  }

  function currentElapsed() {
    try { return typeof elapsed !== 'undefined' ? elapsed : 0; } catch { return 0; }
  }

  function choosePixelRatio() {
    const deviceRatio = Math.max(1, Number(window.devicePixelRatio) || 1);
    const coarsePointer = typeof window.matchMedia === 'function' && window.matchMedia('(pointer: coarse)').matches;
    const narrowViewport = Math.min(window.innerWidth || 960, window.innerHeight || 540) < 700;
    return Math.min(deviceRatio, coarsePointer || narrowViewport ? 1 : 1.25);
  }

  function installStack() {
    if (gameCanvas.parentElement?.dataset.seedThreeStack === 'ready') return gameCanvas.parentElement;
    const wrapper = document.createElement('div');
    wrapper.dataset.seedThreeStack = 'ready';
    wrapper.style.position = 'relative';
    wrapper.style.width = '100%';
    wrapper.style.aspectRatio = '16 / 9';
    wrapper.style.overflow = 'hidden';
    wrapper.style.borderRadius = '18px';
    wrapper.style.contain = 'layout paint size';

    gameCanvas.before(wrapper);
    wrapper.appendChild(gameCanvas);

    gameCanvas.style.position = 'relative';
    gameCanvas.style.zIndex = '2';
    gameCanvas.style.width = '100%';
    gameCanvas.style.height = '100%';
    gameCanvas.style.background = 'transparent';
    gameCanvas.style.border = '0';
    gameCanvas.style.borderRadius = 'inherit';
    return wrapper;
  }

  function installThreeCanvas(wrapper) {
    const canvas = document.createElement('canvas');
    canvas.width = gameCanvas.width;
    canvas.height = gameCanvas.height;
    canvas.setAttribute('aria-hidden', 'true');
    canvas.tabIndex = -1;
    canvas.dataset.seedThreeCanvas = VERSION;
    canvas.style.position = 'absolute';
    canvas.style.inset = '0';
    canvas.style.zIndex = '1';
    canvas.style.width = '100%';
    canvas.style.height = '100%';
    canvas.style.pointerEvents = 'none';
    canvas.style.border = '0';
    canvas.style.borderRadius = 'inherit';
    canvas.style.background = 'transparent';
    wrapper.prepend(canvas);
    return canvas;
  }

  function installForegroundHooks() {
    window.drawBackground = function drawThreeBackedBackground() {
      const context = gameCanvas.getContext('2d');
      context?.clearRect(0, 0, gameCanvas.width, gameCanvas.height);
    };
    window.drawPlatforms = function drawThreeBackedPlatforms() {};
    window.drawCheckpoints = function drawThreeBackedCheckpoints() {};
    window.drawFinish = function drawThreeBackedFinish() {};
  }

  function restoreForegroundHooks() {
    if (typeof originalDrawBackground === 'function') window.drawBackground = originalDrawBackground;
    if (typeof originalDrawPlatforms === 'function') window.drawPlatforms = originalDrawPlatforms;
    if (typeof originalDrawCheckpoints === 'function') window.drawCheckpoints = originalDrawCheckpoints;
    if (typeof originalDrawFinish === 'function') window.drawFinish = originalDrawFinish;
  }

  function markResizeDirty() {
    resizeDirty = true;
  }

  function resizeIfNeeded() {
    if (!renderer || !stack || !resizeDirty) return false;
    const rect = stack.getBoundingClientRect();
    const width = Math.max(1, Math.round(rect.width || gameCanvas.clientWidth || 960));
    const height = Math.max(1, Math.round(rect.height || gameCanvas.clientHeight || 540));
    resizeDirty = false;
    if (width === lastWidth && height === lastHeight) return false;
    lastWidth = width;
    lastHeight = height;
    renderer.resize(width, height);
    return true;
  }

  function syncLevel(nextLevel) {
    if (!nextLevel) return false;
    const id = nextLevel.id || 'unknown';
    if (id === mountedLevelId && renderer.descriptor) return true;
    renderer.mountLevel(nextLevel);
    mountedLevelId = id;
    shell.dataset.threeLevel = id;
    renderStats = null;
    return true;
  }

  function scheduleLoop() {
    if (disposed || !pageVisible || frameId) return;
    frameId = window.requestAnimationFrame(loop);
  }

  function loop() {
    frameId = 0;
    if (disposed || !pageVisible) return;
    try {
      const nextLevel = currentLevel();
      const nextPlayer = currentPlayer();
      if (nextLevel && syncLevel(nextLevel)) {
        resizeIfNeeded();
        renderer.sync({
          cameraX: currentCameraX(),
          player: nextPlayer,
          elapsed: currentElapsed()
        });
        renderer.render();
        renderStats = renderer.getRenderStats?.() || null;
      }
    } catch (error) {
      console.error('Seed Man Three.js runtime bridge failed.', error);
      dispose('error');
      return;
    }
    scheduleLoop();
  }

  function handleVisibilityChange() {
    pageVisible = !document.hidden;
    if (!pageVisible) {
      if (frameId) window.cancelAnimationFrame(frameId);
      frameId = 0;
      return;
    }
    markResizeDirty();
    scheduleLoop();
  }

  function dispose(reason = 'manual') {
    if (disposed) return;
    disposed = true;
    if (frameId) window.cancelAnimationFrame(frameId);
    frameId = 0;
    resizeObserver?.disconnect?.();
    resizeObserver = null;
    window.removeEventListener('resize', markResizeDirty);
    document.removeEventListener('visibilitychange', handleVisibilityChange);
    restoreForegroundHooks();
    renderer?.dispose?.();
    threeCanvas?.remove();
    if (stack?.dataset.seedThreeStack === 'ready' && gameCanvas.parentElement === stack) {
      stack.before(gameCanvas);
      stack.remove();
    }
    gameCanvas.style.position = '';
    gameCanvas.style.zIndex = '';
    gameCanvas.style.width = '';
    gameCanvas.style.height = '';
    gameCanvas.style.background = '';
    gameCanvas.style.border = '';
    gameCanvas.style.borderRadius = '';
    shell.dataset.threeWorld = 'fallback';
    document.documentElement.dataset.seedThreeWorld = `fallback-${reason}`;
  }

  try {
    if (api.version !== EXPECTED_API_VERSION) {
      throw new Error(`Unexpected Seed Man public API version: ${api.version || 'unknown'}`);
    }
    stack = installStack();
    threeCanvas = installThreeCanvas(stack);
    selectedPixelRatio = choosePixelRatio();
    renderer = api.createRenderer({ canvas: threeCanvas, pixelRatio: selectedPixelRatio });
    if (!renderer) throw new Error('WebGL renderer could not be created.');
    if (renderer.version !== EXPECTED_RENDERER_VERSION) {
      throw new Error(`Unexpected Seed Man renderer version: ${renderer.version || 'unknown'}`);
    }
    if (renderer.optimization !== EXPECTED_OPTIMIZATION) {
      throw new Error(`Unexpected Seed Man renderer optimization: ${renderer.optimization || 'none'}`);
    }
    installForegroundHooks();
    shell.dataset.threeWorld = VERSION;
    document.documentElement.dataset.seedThreeWorld = 'active';
    document.documentElement.dataset.seedThreeRenderer = renderer.version;
    document.documentElement.dataset.seedThreeOptimization = renderer.optimization;
    document.documentElement.dataset.seedThreePixelRatio = String(selectedPixelRatio);

    resizeIfNeeded();
    if (typeof ResizeObserver === 'function') {
      resizeObserver = new ResizeObserver(markResizeDirty);
      resizeObserver.observe(stack);
    }
    window.addEventListener('resize', markResizeDirty, { passive: true });
    document.addEventListener('visibilitychange', handleVisibilityChange, { passive: true });
    window.addEventListener('sprout:level-selected', () => {
      mountedLevelId = null;
    });
    scheduleLoop();

    window.__SPROUT_THREE_ADAPTER__ = Object.freeze({
      version: VERSION,
      active: true,
      snapshot: () => ({
        mountedLevelId,
        rendererVersion: renderer?.version || null,
        rendererOptimization: renderer?.optimization || null,
        worldVersion: api.version || null,
        webgl: true,
        width: lastWidth,
        height: lastHeight,
        pixelRatio: selectedPixelRatio,
        pageVisible,
        renderStats
      }),
      dispose
    });
  } catch (error) {
    console.error('Seed Man Three.js adapter could not start.', error);
    dispose('boot');
  }
})();