'use strict';

/*
 * Seed Man flexible canvas renderer.
 * No external character atlas or fixed art owner is required.
 * The renderer can be replaced by future sprite, skeletal, canvas, or WebGL art.
 */

(() => {
  const VERSION = 'seed-man-flexible-canvas-renderer-v1';
  const FORMS = new Set(['plant', 'fire', 'electric', 'ice']);

  function state() {
    try { return typeof player !== 'undefined' ? player : null; }
    catch { return null; }
  }

  function phenotype() {
    try {
      const snapshot = window.__SPROUT_COMBAT_BROWSER__?.snapshot?.() || null;
      const form = snapshot?.phenotypeForm || snapshot?.activePhenotype || 'plant';
      return FORMS.has(form) ? form : 'plant';
    } catch { return 'plant'; }
  }

  function accents(form) {
    if (form === 'fire') return { glow: '#ff8a3d', leaf: '#ffb45e' };
    if (form === 'electric') return { glow: '#ffe45a', leaf: '#c9f34d' };
    if (form === 'ice') return { glow: '#8de5ff', leaf: '#bcefff' };
    return { glow: '#83cf69', leaf: '#74b957' };
  }

  function strokeLine(x1, y1, x2, y2, width = 5) {
    ctx.lineWidth = width;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(x1, y1);
    ctx.lineTo(x2, y2);
    ctx.stroke();
  }

  function glove(x, y, flip = 1) {
    ctx.save();
    ctx.translate(x, y);
    ctx.scale(flip, 1);
    ctx.fillStyle = '#fffdf6';
    ctx.strokeStyle = '#171a16';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.ellipse(0, 0, 8, 7, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(6, -2, 4, -.8, 1.15);
    ctx.stroke();
    ctx.restore();
  }

  function shoe(x, y, flip = 1) {
    ctx.save();
    ctx.translate(x, y);
    ctx.scale(flip, 1);
    ctx.fillStyle = '#fffdf6';
    ctx.strokeStyle = '#171a16';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.ellipse(4, 0, 11, 6, -.08, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    ctx.restore();
  }

  function drawSeedManProduction() {
    const s = state();
    if (!s || typeof ctx === 'undefined' || !ctx) return;

    const form = phenotype();
    const accent = accents(form);
    const camera = typeof cameraX === 'number' ? cameraX : 0;
    const facing = Number(s.vx || 0) < -1 ? -1 : 1;
    const moving = Math.abs(Number(s.vx || 0)) > 14;
    const airborne = !s.grounded;
    const t = (performance.now?.() || 0) * 0.012;
    const bob = moving && !airborne ? Math.sin(t * 1.8) * 2 : airborne ? -2 : Math.sin(t) * .7;
    const stride = moving && !airborne ? Math.sin(t * 1.8) * 8 : 0;
    const centerX = Number(s.x || 0) - camera + Number(s.width || 34) / 2;
    const feetY = Number(s.y || 0) + Number(s.height || 46) + 3;

    ctx.save();
    ctx.translate(centerX, feetY + bob);
    ctx.scale(facing, 1);

    if (form !== 'plant') {
      ctx.save();
      ctx.globalAlpha = .18;
      ctx.fillStyle = accent.glow;
      ctx.beginPath();
      ctx.ellipse(0, -47, 35, 45, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }

    if (s.grounded) {
      ctx.save();
      ctx.scale(facing, 1);
      ctx.globalAlpha = .18;
      ctx.fillStyle = '#0b130d';
      ctx.beginPath();
      ctx.ellipse(0, 3 - bob, 23, 5, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }

    ctx.strokeStyle = '#171a16';
    strokeLine(-9, -27, -17 - stride * .45, -4, 5);
    strokeLine(9, -27, 17 + stride * .45, -4, 5);
    shoe(-19 - stride * .45, -1, -1);
    shoe(19 + stride * .45, -1, 1);

    const armSwing = moving && !airborne ? Math.sin(t * 1.8) * 7 : airborne ? -6 : 0;
    strokeLine(-19, -49, -30 + armSwing, -30, 5);
    strokeLine(19, -49, 30 - armSwing, -30, 5);
    glove(-31 + armSwing, -29, -1);
    glove(31 - armSwing, -29, 1);

    ctx.fillStyle = '#8b5f3c';
    ctx.strokeStyle = '#171a16';
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.ellipse(0, -46, 25, 31, -.04, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();

    ctx.save();
    ctx.globalAlpha = .22;
    ctx.strokeStyle = '#5d3a26';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(-10, -70);
    ctx.quadraticCurveTo(1, -50, 9, -22);
    ctx.stroke();
    ctx.restore();

    ctx.strokeStyle = '#171a16';
    ctx.fillStyle = '#171a16';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(-8, -51, 2.8, 0, Math.PI * 2);
    ctx.arc(8, -51, 2.8, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.arc(0, -40, 8, .2, Math.PI - .2);
    ctx.stroke();

    ctx.strokeStyle = '#2d5c2d';
    ctx.lineWidth = 4;
    strokeLine(0, -76, 0, -86, 4);
    ctx.fillStyle = accent.leaf;
    ctx.strokeStyle = '#204521';
    ctx.lineWidth = 2.5;
    for (const leaf of [
      { x: 0, y: -91, rx: 7, ry: 12, r: 0 },
      { x: -8, y: -87, rx: 6, ry: 11, r: -.75 },
      { x: 8, y: -87, rx: 6, ry: 11, r: .75 }
    ]) {
      ctx.save();
      ctx.translate(leaf.x, leaf.y);
      ctx.rotate(leaf.r);
      ctx.beginPath();
      ctx.ellipse(0, 0, leaf.rx, leaf.ry, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
      ctx.restore();
    }

    ctx.restore();
    document.documentElement.dataset.seedManRendererOwner = VERSION;
    document.documentElement.dataset.seedManArtPipeline = 'flexible';
  }

  window.drawSeedManProduction = drawSeedManProduction;
  window.drawSeedMan = drawSeedManProduction;
  window.__SEED_MAN_PRODUCTION_ART__ = Object.freeze({
    version: VERSION,
    pipeline: 'flexible-canvas',
    externalCharacterAtlas: false,
    phenotypeForms: Object.freeze([...FORMS]),
    draw: drawSeedManProduction
  });
})();
