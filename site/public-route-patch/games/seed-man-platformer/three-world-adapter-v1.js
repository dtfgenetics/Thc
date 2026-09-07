'use strict';

(() => {
  const VERSION = 'seed-man-three-adapter-v1';
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

  function installStack() {
    if (gameCanvas.parentElement?.dataset.seedThreeStack === 'ready') return gameCanvas.parentElement;
    const wrapper = document.createElement('div');
    wrapper.dataset.seedThreeStack = 'ready';
    wrapper.style.position = 'relative';
    wrapper.style.width = '100%';
    wrapper.style.aspectRatio = '16 / 9';
    wrapper.style.overflow = 'hidden';
    wrapper.style.borderRadius = '18px';

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

  function resize() {
    if (!renderer || !stack) return;
    const rect = stack.getBoundingClientRect();
    renderer.resize(rect.width || gameCanvas.clientWidth || 960, rect.height || gameCanvas.clientHeight || 540);
  }

  function syncLevel(nextLevel) {
    if (!nextLevel) return false;
    const id = nextLevel.id || 'unknown';
    if (id === mountedLevelId && renderer.descriptor) return true;
    renderer.mountLevel(nextLevel);
    mountedLevelId = id;
    shell.dataset.threeLevel = id;
    return true;
  }

  function loop() {
    if (disposed) return;
    try {
      const nextLevel = currentLevel();
      const nextPlayer = currentPlayer();
      if (nextLevel && syncLevel(nextLevel)) {
        resize();
        renderer.sync({
          cameraX: currentCameraX(),
          player: nextPlayer,
          elapsed: currentElapsed()
        });
        renderer.render();
      }
    } catch (error) {
      console.error('Seed Man Three.js runtime bridge failed.', error);
      dispose('error');
      return;
    }
    frameId = window.requestAnimationFrame(loop);
  }

  function dispose(reason = 'manual') {
    if (disposed) return;
    disposed = true;
    window.cancelAnimationFrame(frameId);
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
    stack = installStack();
    threeCanvas = installThreeCanvas(stack);
    renderer = api.createRenderer({ canvas: threeCanvas });
    if (!renderer) throw new Error('WebGL renderer could not be created.');
    installForegroundHooks();
    shell.dataset.threeWorld = VERSION;
    document.documentElement.dataset.seedThreeWorld = 'active';
    resize();
    window.addEventListener('resize', resize, { passive: true });
    window.addEventListener('sprout:level-selected', () => {
      mountedLevelId = null;
    });
    frameId = window.requestAnimationFrame(loop);

    window.__SPROUT_THREE_ADAPTER__ = Object.freeze({
      version: VERSION,
      active: true,
      snapshot: () => ({
        mountedLevelId,
        rendererVersion: renderer?.version || null,
        worldVersion: api.version || null,
        webgl: true
      }),
      dispose
    });
  } catch (error) {
    console.error('Seed Man Three.js adapter could not start.', error);
    dispose('boot');
  }
})();