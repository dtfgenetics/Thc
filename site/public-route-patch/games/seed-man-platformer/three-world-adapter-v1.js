'use strict';

(() => {
  const VERSION = 'seed-man-three-adapter-v2';
  const VISUAL_THEME_VERSION = 'seed-man-world-themes-v1';
  const EXPECTED_API_VERSION = 'seed-man-three-public-v2';
  const EXPECTED_RENDERER_VERSION = 'seed-man-three-world-v2';
  const EXPECTED_OPTIMIZATION = 'seed-man-three-instancing-v1';
  const gameCanvas = document.querySelector('#game');
  const shell = document.querySelector('.game-shell');
  const api = window.SeedManThreeWorld;

  const WORLD_THEMES = Object.freeze({
    greenhouse: { sky: 0x8bcfb6, fog: 0xb9dec8, platform: 0x426b45, top: 0x9ad369, edge: 0x203a29, frame: 0x335f50, leafDark: 0x173b2b, leafLight: 0x6f9e58 },
    nursery: { sky: 0x173547, fog: 0x325369, platform: 0x385d55, top: 0x7cd6a4, edge: 0x162d2e, frame: 0x4b6975, leafDark: 0x16382d, leafLight: 0x5e9f72 },
    hydro: { sky: 0x174c66, fog: 0x4c8496, platform: 0x24566b, top: 0x62d3e6, edge: 0x123441, frame: 0x5e8791, leafDark: 0x15484d, leafLight: 0x5fb9a7 },
    roots: { sky: 0x8d704f, fog: 0xb89a73, platform: 0x66513b, top: 0x9eb765, edge: 0x3b2b20, frame: 0x5f4b38, leafDark: 0x334222, leafLight: 0x82965b },
    mycelium: { sky: 0x4b3762, fog: 0x77618a, platform: 0x4e4056, top: 0xa884c6, edge: 0x292132, frame: 0x675477, leafDark: 0x2e3141, leafLight: 0x8c7da6 },
    trichome: { sky: 0x527381, fog: 0x89a7af, platform: 0x50646c, top: 0xc9eef0, edge: 0x29383d, frame: 0x748a92, leafDark: 0x29494b, leafLight: 0x83b2a5 },
    cavern: { sky: 0x312d45, fog: 0x5a526f, platform: 0x454151, top: 0xb8a3d2, edge: 0x201d2b, frame: 0x645c76, leafDark: 0x27382f, leafLight: 0x718b69 },
    refinery: { sky: 0x5a342a, fog: 0x8e6252, platform: 0x54443d, top: 0xd9935b, edge: 0x2d2522, frame: 0x76635b, leafDark: 0x34402c, leafLight: 0x808c5a },
    terpene: { sky: 0x315c54, fog: 0x648c79, platform: 0x375d51, top: 0xe0c867, edge: 0x1d372f, frame: 0x557d70, leafDark: 0x1f4836, leafLight: 0x72a667 },
    frost: { sky: 0x9ac7d9, fog: 0xd1edf3, platform: 0x638691, top: 0xdaf8ff, edge: 0x35515c, frame: 0x789aa7, leafDark: 0x40696b, leafLight: 0x94c1b4 },
    citadel: { sky: 0x62563b, fog: 0xa49468, platform: 0x514a3a, top: 0xf0d66d, edge: 0x2f2a20, frame: 0x85765a, leafDark: 0x38412a, leafLight: 0x899760 },
    genetic: { sky: 0x3f315d, fog: 0x746590, platform: 0x493e61, top: 0xcf9cff, edge: 0x272036, frame: 0x6f5d89, leafDark: 0x25384b, leafLight: 0x78a2a4 }
  });

  if (!gameCanvas || !shell || !api?.supportsWebGL?.() || typeof api.createRenderer !== 'function') {
    document.documentElement.dataset.seedThreeWorld = 'fallback';
    return;
  }

  let renderer = null;
  let threeCanvas = null;
  let stack = null;
  let mountedLevelId = null;
  let mountedVisualTheme = 'greenhouse';
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

  function visualThemeKey(theme = '') {
    if (theme === 'nursery') return 'nursery';
    if (theme === 'hydro') return 'hydro';
    if (theme === 'root-zone') return 'roots';
    if (theme === 'mycelium') return 'mycelium';
    if (theme === 'trichome') return 'trichome';
    if (theme === 'cavern') return 'cavern';
    if (theme === 'refinery') return 'refinery';
    if (theme === 'terpene') return 'terpene';
    if (theme === 'frost') return 'frost';
    if (theme === 'citadel') return 'citadel';
    if (['chromosome', 'mutation-marsh', 'allele-array', 'genome-spire', 'genetic'].includes(theme)) return 'genetic';
    return 'greenhouse';
  }

  function setMaterialColor(material, hex) {
    if (!material?.color?.setHex || !Number.isFinite(hex)) return;
    material.color.setHex(hex);
  }

  function applyWorldTheme(descriptor) {
    if (!renderer?.scene || !descriptor) return;
    const key = visualThemeKey(descriptor.level?.theme);
    const theme = WORLD_THEMES[key] || WORLD_THEMES.greenhouse;
    mountedVisualTheme = key;
    renderer.scene.background?.setHex?.(theme.sky);
    renderer.scene.fog?.color?.setHex?.(theme.fog);

    renderer.scene.traverse((child) => {
      if (!child?.material) return;
      const material = Array.isArray(child.material) ? child.material[0] : child.material;
      const name = child.name || '';
      if (name.includes('platforms-v1')) setMaterialColor(material, theme.platform);
      else if (name.includes('platform-caps-v1')) setMaterialColor(material, theme.top);
      else if (name.includes('platform-edges-v1')) setMaterialColor(material, theme.edge);
      else if (name.includes('greenhouse-ribs-v1') || name.includes('greenhouse-braces-v1')) setMaterialColor(material, theme.frame);
      else if (name.includes('plant-leaves-dark-v1')) setMaterialColor(material, theme.leafDark);
      else if (name.includes('plant-leaves-light-v1')) setMaterialColor(material, theme.leafLight);
    });

    shell.dataset.seedVisualTheme = key;
    document.body.dataset.seedVisualWorld = key;
    document.documentElement.dataset.seedThreeTheme = key;
    document.documentElement.dataset.seedThreeThemeVersion = VISUAL_THEME_VERSION;
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
    const descriptor = renderer.mountLevel(nextLevel);
    mountedLevelId = id;
    shell.dataset.threeLevel = id;
    renderStats = null;
    applyWorldTheme(descriptor);
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
      visualThemeVersion: VISUAL_THEME_VERSION,
      active: true,
      snapshot: () => ({
        mountedLevelId,
        mountedVisualTheme,
        rendererVersion: renderer?.version || null,
        rendererOptimization: renderer?.optimization || null,
        worldVersion: api.version || null,
        visualThemeVersion: VISUAL_THEME_VERSION,
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