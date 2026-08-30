'use strict';

/*
 * Sprout Run Canvas2D compatibility layer.
 * Loaded before app.js so the game can request a software-backed 2D context
 * on browsers/devices where GPU-backed Canvas2D can be lost or render blank.
 */
(() => {
  const VERSION = 'sprout-canvas-compat-v1';
  const RELEASE = '20260830-r7';
  const proto = window.HTMLCanvasElement?.prototype;
  const nativeGetContext = proto?.getContext;
  if (!proto || typeof nativeGetContext !== 'function') return;

  let gameContext = null;
  let restored = 0;
  let lost = 0;

  function patchedGetContext(type, attributes) {
    if (this.id !== 'game' || type !== '2d') {
      return nativeGetContext.call(this, type, attributes);
    }

    const preferred = {
      ...(attributes || {}),
      alpha: false,
      desynchronized: false,
      willReadFrequently: true,
    };

    try {
      gameContext = nativeGetContext.call(this, type, preferred);
    } catch (error) {
      console.warn('Sprout Run software Canvas2D request failed; retrying default context.', error);
    }

    if (!gameContext) gameContext = nativeGetContext.call(this, type, attributes);
    if (!gameContext) gameContext = nativeGetContext.call(this, type);
    return gameContext;
  }

  proto.getContext = patchedGetContext;

  const redraw = () => {
    window.requestAnimationFrame(() => {
      try {
        if (typeof window.render === 'function') window.render();
      } catch (error) {
        console.warn('Sprout Run redraw after canvas recovery failed.', error);
      }
    });
  };

  const canvas = document.querySelector('#game');
  if (canvas) {
    canvas.addEventListener('contextlost', () => {
      lost += 1;
      canvas.dataset.contextState = 'lost';
      console.warn('Sprout Run Canvas2D context was lost; waiting for browser restoration.');
    });

    canvas.addEventListener('contextrestored', () => {
      restored += 1;
      canvas.dataset.contextState = 'restored';
      redraw();
    });
  }

  window.addEventListener('pageshow', redraw);
  window.addEventListener('orientationchange', redraw);
  window.addEventListener('resize', redraw, { passive: true });

  // app.js is a deferred classic script loaded immediately after this file.
  // Restore the native prototype after deferred scripts initialize so the
  // compatibility request stays scoped to Sprout Run rather than the page.
  window.addEventListener('DOMContentLoaded', () => {
    if (proto.getContext === patchedGetContext) proto.getContext = nativeGetContext;
  }, { once: true });

  window.__SPROUT_CANVAS_COMPAT__ = Object.freeze({
    version: VERSION,
    release: RELEASE,
    softwarePreferred: true,
    get contextLostCount() { return lost; },
    get contextRestoredCount() { return restored; },
  });
})();
