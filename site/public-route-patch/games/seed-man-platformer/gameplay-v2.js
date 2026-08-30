'use strict';

/*
 * Sprout Run gameplay expansion v2.
 * Original DTF Genetics gameplay code, informed by standard platformer patterns:
 * one-way moving platforms, stompable patrol enemies, bounce pads, particles,
 * squash/stretch and impact shake. No third-party runtime code or assets.
 */

(() => {
  const GAMEPLAY_VERSION = 'sprout-run-gameplay-v2';
  const STOMP_BOUNCE_SPEED = 500;
  const PAD_BOUNCE_SPEED = 790;
  const PEST_HIT_INVULN = 0.85;

  const movingPlatformDefs = [
    { id: 'table-01', x: 612, y: 410, width: 92, height: 16, axis: 'x', range: 48, speed: 1.25, phase: 0.2 },
    { id: 'table-02', x: 1914, y: 394, width: 108, height: 16, axis: 'x', range: 52, speed: 1.05, phase: 2.1 },
    { id: 'lift-01', x: 3330, y: 365, width: 106, height: 16, axis: 'y', range: 74, speed: 0.9, phase: 1.1 },
    { id: 'table-03', x: 4690, y: 397, width: 112, height: 16, axis: 'x', range: 55, speed: 1.15, phase: 3.2 },
    { id: 'lift-02', x: 6125, y: 352, width: 108, height: 16, axis: 'y', range: 82, speed: 0.82, phase: 0.6 },
    { id: 'table-04', x: 6792, y: 395, width: 112, height: 16, axis: 'x', range: 52, speed: 1.18, phase: 4.0 }
  ];

  const pestDefs = [
    { id: 'aphid-01', x: 880, y: 456, width: 28, height: 24, minX: 760, maxX: 1090, speed: 54 },
    { id: 'mite-01', x: 1455, y: 366, width: 28, height: 24, minX: 1410, maxX: 1535, speed: 45 },
    { id: 'aphid-02', x: 2140, y: 456, width: 28, height: 24, minX: 2070, maxX: 2470, speed: 58 },
    { id: 'mite-02', x: 3420, y: 456, width: 28, height: 24, minX: 3390, maxX: 3840, speed: 62 },
    { id: 'aphid-03', x: 4270, y: 341, width: 28, height: 24, minX: 4260, maxX: 4380, speed: 48 },
    { id: 'mite-03', x: 5520, y: 456, width: 28, height: 24, minX: 5500, maxX: 5980, speed: 64 },
    { id: 'aphid-04', x: 6280, y: 456, width: 28, height: 24, minX: 6260, maxX: 6670, speed: 58 },
    { id: 'mite-04', x: 6970, y: 456, width: 28, height: 24, minX: 6940, maxX: 7350, speed: 66 }
  ];

  const bouncePads = [
    { id: 'pad-01', x: 1768, y: 462, width: 56, height: 18 },
    { id: 'pad-02', x: 4370, y: 347, width: 54, height: 18 },
    { id: 'pad-03', x: 5942, y: 282, width: 54, height: 18 },
    { id: 'pad-04', x: 7184, y: 342, width: 54, height: 18 }
  ];

  let movingPlatforms = [];
  let pests = [];
  let particles = [];
  let shakeTime = 0;
  let shakeMagnitude = 0;
  let flashTime = 0;
  let flashDuration = 0;
  let flashColor = '#ffffff';
  let squashTime = 0;
  let stretchTime = 0;
  let simTime = 0;
  const stats = { stomps: 0, pestHits: 0, padBounces: 0 };

  const rectsOverlap = (a, b) =>
    a.x < b.x + b.width && a.x + a.width > b.x && a.y < b.y + b.height && a.y + a.height > b.y;

  function cloneMovingPlatform(def) {
    return {
      ...def,
      baseX: def.x,
      baseY: def.y,
      prevX: def.x,
      prevY: def.y,
      dx: 0,
      dy: 0,
      t: def.phase || 0
    };
  }

  function clonePest(def, index) {
    return { ...def, dir: index % 2 === 0 ? 1 : -1, dead: false, deadTimer: 0, squash: 0 };
  }

  function resetGameplayV2() {
    movingPlatforms = movingPlatformDefs.map(cloneMovingPlatform);
    pests = pestDefs.map(clonePest);
    particles = [];
    shakeTime = 0;
    shakeMagnitude = 0;
    flashTime = 0;
    flashDuration = 0;
    squashTime = 0;
    stretchTime = 0;
    simTime = 0;
    stats.stomps = 0;
    stats.pestHits = 0;
    stats.padBounces = 0;
  }

  function addShake(magnitude, duration) {
    shakeMagnitude = Math.max(shakeMagnitude, magnitude);
    shakeTime = Math.max(shakeTime, duration);
  }

  function addFlash(color, duration) {
    flashColor = color;
    flashDuration = duration;
    flashTime = duration;
  }

  function burst(x, y, color, count = 10, speed = 120) {
    for (let i = 0; i < count; i += 1) {
      const angle = Math.random() * Math.PI * 2;
      const velocity = speed * (0.45 + Math.random() * 0.8);
      particles.push({
        x,
        y,
        vx: Math.cos(angle) * velocity,
        vy: Math.sin(angle) * velocity - 55,
        life: 0.35 + Math.random() * 0.35,
        maxLife: 0.7,
        size: 2 + Math.random() * 3,
        color
      });
    }
  }

  function updateFx(dt) {
    shakeTime = Math.max(0, shakeTime - dt);
    flashTime = Math.max(0, flashTime - dt);
    squashTime = Math.max(0, squashTime - dt);
    stretchTime = Math.max(0, stretchTime - dt);
    for (const p of particles) {
      p.vy += 360 * dt;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.life -= dt;
    }
    particles = particles.filter((p) => p.life > 0);
  }

  function updateMovingPlatforms(dt) {
    for (const platform of movingPlatforms) {
      platform.prevX = platform.x;
      platform.prevY = platform.y;
      platform.t += platform.speed * dt;
      const wave = Math.sin(platform.t);
      platform.x = platform.baseX + (platform.axis === 'x' ? wave * platform.range : 0);
      platform.y = platform.baseY + (platform.axis === 'y' ? wave * platform.range : 0);
      platform.dx = platform.x - platform.prevX;
      platform.dy = platform.y - platform.prevY;
    }
  }

  function updatePests(dt) {
    for (const pest of pests) {
      if (pest.dead) {
        pest.deadTimer -= dt;
        pest.squash = Math.max(0, pest.deadTimer / 0.45);
        continue;
      }
      pest.x += pest.dir * pest.speed * dt;
      if (pest.x <= pest.minX) {
        pest.x = pest.minX;
        pest.dir = 1;
      } else if (pest.x + pest.width >= pest.maxX) {
        pest.x = pest.maxX - pest.width;
        pest.dir = -1;
      }
    }
  }

  function resolveMovingPlatforms(next, previous) {
    if (next.vy < 0) return;
    const previousFeet = previous.y + previous.height;
    const nextFeet = next.y + next.height;
    for (const platform of movingPlatforms) {
      const horizontal = next.x + next.width > platform.x + 3 && next.x < platform.x + platform.width - 3;
      if (!horizontal) continue;
      const top = platform.y;
      const crossedTop = previousFeet <= platform.prevY + 8 && nextFeet >= top - 5 && nextFeet <= top + 18 + Math.max(0, platform.dy);
      const resting = Math.abs(nextFeet - top) <= 6 && previousFeet <= platform.prevY + 8;
      if (!crossedTop && !resting) continue;
      next.y = top - next.height;
      next.vy = 0;
      next.grounded = true;
      next.airJumpsRemaining = DEFAULTS.maxAirJumps;
      next.x = Math.max(0, Math.min(level.worldWidth - next.width, next.x + platform.dx));
      if (!['hurt', 'shield-bounce'].includes(next.state)) next.state = Math.abs(next.vx) > 1 ? 'run' : 'idle';
      return;
    }
  }

  function resolveBouncePads(next, previous) {
    if (next.vy < 0) return;
    const previousFeet = previous.y + previous.height;
    const nextFeet = next.y + next.height;
    for (const pad of bouncePads) {
      const horizontal = next.x + next.width > pad.x + 4 && next.x < pad.x + pad.width - 4;
      const crossed = previousFeet <= pad.y + 6 && nextFeet >= pad.y - 4 && nextFeet <= pad.y + pad.height + 12;
      if (!horizontal || !crossed) continue;
      next.y = pad.y - next.height;
      next.vy = -PAD_BOUNCE_SPEED;
      next.grounded = false;
      next.coyote = 0;
      next.airJumpsRemaining = Math.max(1, next.airJumpsRemaining);
      next.state = 'boost-bounce';
      stats.padBounces += 1;
      stretchTime = 0.18;
      addShake(4, 0.16);
      burst(pad.x + pad.width / 2, pad.y, '#c8f36a', 16, 150);
      return;
    }
  }

  function resolvePests(next, previous) {
    for (const pest of pests) {
      if (pest.dead || !rectsOverlap(next, pest)) continue;
      const previousFeet = previous.y + previous.height;
      const fromAbove = previous.vy >= 0 && next.vy >= 0 && previousFeet <= pest.y + 8;
      if (fromAbove) {
        pest.dead = true;
        pest.deadTimer = 0.45;
        pest.squash = 1;
        next.y = pest.y - next.height;
        next.vy = -STOMP_BOUNCE_SPEED;
        next.grounded = false;
        next.airJumpsRemaining = Math.max(1, next.airJumpsRemaining);
        next.state = 'stomp-bounce';
        stats.stomps += 1;
        stretchTime = 0.16;
        addShake(5.5, 0.2);
        burst(pest.x + pest.width / 2, pest.y + 6, '#a7e46f', 18, 155);
        return;
      }

      if ((next.power?.invulnerableTimer || 0) > 0) continue;
      const playerCenter = next.x + next.width / 2;
      const pestCenter = pest.x + pest.width / 2;
      const knockDir = playerCenter < pestCenter ? -1 : 1;
      if ((next.power?.shieldCharges || 0) > 0) {
        next.power.shieldCharges -= 1;
        next.power.invulnerableTimer = Math.max(next.power.invulnerableTimer || 0, DEFAULTS.shieldInvulnerability);
        next.vx = knockDir * 330;
        next.vy = -330;
        next.state = 'shield-bounce';
        pest.dir *= -1;
        addFlash('rgba(133,215,255,0.32)', 0.18);
        addShake(5, 0.18);
        burst(playerCenter, next.y + next.height / 2, '#85d7ff', 12, 130);
      } else {
        next.power.invulnerableTimer = PEST_HIT_INVULN;
        next.vx = knockDir * 360;
        next.vy = -290;
        next.grounded = false;
        next.state = 'hurt';
        next.pestHits = (next.pestHits || 0) + 1;
        stats.pestHits += 1;
        squashTime = 0.16;
        addFlash('rgba(255,112,86,0.28)', 0.2);
        addShake(6.5, 0.24);
        burst(playerCenter, next.y + next.height / 2, '#ff8b68', 14, 145);
      }
      return;
    }
  }

  function detectBaseEvents(previous, next) {
    if (next.collected.length > previous.collected.length) {
      const id = next.collected[next.collected.length - 1];
      const item = level.pickups.find((pickup) => pickup.id === id);
      if (item) burst(item.x + item.width / 2, item.y + item.height / 2, '#8ed85f', 9, 105);
    }
    if (next.collectedPowerups.length > previous.collectedPowerups.length) {
      burst(next.x + next.width / 2, next.y + next.height / 2, '#f3c867', 14, 135);
      addShake(3, 0.12);
    }
    if (!previous.grounded && next.grounded && previous.vy > 300) {
      squashTime = 0.12;
      burst(next.x + next.width / 2, next.y + next.height, '#d8c7a4', 7, 70);
    }
    if (next.deaths > previous.deaths) {
      addFlash('rgba(255,104,75,0.24)', 0.24);
      addShake(8, 0.28);
    }
  }

  function drawMovingPlatformsAndPads() {
    for (const platform of movingPlatforms) {
      const x = Math.round(platform.x - cameraX);
      const y = Math.round(platform.y);
      ctx.fillStyle = '#243f2d';
      ctx.fillRect(x, y, platform.width, platform.height);
      ctx.fillStyle = '#9bc76b';
      ctx.fillRect(x, y, platform.width, 5);
      ctx.strokeStyle = '#16291d';
      ctx.lineWidth = 2;
      ctx.strokeRect(x, y, platform.width, platform.height);
      ctx.fillStyle = '#d9ead0';
      ctx.font = '800 8px system-ui';
      ctx.fillText(platform.axis === 'y' ? 'LIFT' : 'TABLE', x + 8, y + 12);
    }

    for (const pad of bouncePads) {
      const x = Math.round(pad.x - cameraX);
      ctx.fillStyle = '#213524';
      ctx.fillRect(x, pad.y, pad.width, pad.height);
      ctx.fillStyle = '#c8f36a';
      ctx.beginPath();
      ctx.moveTo(x + 5, pad.y + pad.height);
      ctx.lineTo(x + pad.width / 2, pad.y + 2 + Math.sin(simTime * 8) * 2);
      ctx.lineTo(x + pad.width - 5, pad.y + pad.height);
      ctx.closePath();
      ctx.fill();
      ctx.fillStyle = '#10291d';
      ctx.font = '900 9px system-ui';
      ctx.fillText('BOOST', x + 10, pad.y + 15);
    }
  }

  function drawPests() {
    for (const pest of pests) {
      if (pest.dead && pest.deadTimer <= 0) continue;
      const x = pest.x - cameraX + pest.width / 2;
      const y = pest.y + pest.height / 2;
      const squash = pest.dead ? 0.38 + 0.35 * pest.squash : 1;
      ctx.save();
      ctx.translate(x, y + (1 - squash) * 7);
      ctx.scale(pest.dir, squash);
      ctx.fillStyle = pest.id.startsWith('mite') ? '#a95b49' : '#759d42';
      ctx.strokeStyle = '#182019';
      ctx.lineWidth = 2.3;
      ctx.beginPath();
      ctx.ellipse(0, 1, 11, 8, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
      ctx.fillStyle = '#dfeccf';
      ctx.beginPath();
      ctx.arc(5, -3, 2.4, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#182019';
      ctx.beginPath();
      ctx.arc(5.5, -3, 1, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = '#182019';
      ctx.lineWidth = 1.8;
      for (const legY of [-3, 2, 6]) {
        ctx.beginPath();
        ctx.moveTo(-7, legY);
        ctx.lineTo(-13, legY + 3);
        ctx.moveTo(7, legY);
        ctx.lineTo(13, legY + 3);
        ctx.stroke();
      }
      ctx.restore();
    }
  }

  function drawParticles() {
    for (const p of particles) {
      const alpha = Math.max(0, Math.min(1, p.life / p.maxLife));
      ctx.globalAlpha = alpha;
      ctx.fillStyle = p.color;
      ctx.beginPath();
      ctx.arc(p.x - cameraX, p.y, p.size, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;
  }

  const baseStepPlayer = stepPlayer;
  stepPlayer = function gameplayV2Step(inputPlayer, inputState, levelData, dt, config = DEFAULTS) {
    const previousState = inputPlayer;
    simTime += dt;
    updateMovingPlatforms(dt);
    updatePests(dt);
    updateFx(dt);
    const next = baseStepPlayer(inputPlayer, inputState, levelData, dt, config);
    detectBaseEvents(previousState, next);
    if (next.finished || next.deaths > previousState.deaths) return next;
    resolveMovingPlatforms(next, previousState);
    resolveBouncePads(next, previousState);
    resolvePests(next, previousState);
    return next;
  };

  const baseReset = reset;
  reset = function gameplayV2Reset() {
    baseReset();
    resetGameplayV2();
  };

  const baseDrawPlatforms = drawPlatforms;
  drawPlatforms = function gameplayV2DrawPlatforms() {
    baseDrawPlatforms();
    drawMovingPlatformsAndPads();
    drawPests();
  };

  const baseDrawSeedMan = drawSeedMan;
  drawSeedMan = function gameplayV2DrawSeedMan() {
    const centerX = player.x - cameraX + player.width / 2;
    const centerY = player.y + player.height / 2;
    let sx = 1;
    let sy = 1;
    if (stretchTime > 0) {
      const f = Math.min(1, stretchTime / 0.18);
      sx = 1 - 0.12 * f;
      sy = 1 + 0.18 * f;
    } else if (squashTime > 0) {
      const f = Math.min(1, squashTime / 0.16);
      sx = 1 + 0.16 * f;
      sy = 1 - 0.14 * f;
    }
    ctx.save();
    ctx.translate(centerX, centerY);
    ctx.scale(sx, sy);
    ctx.translate(-centerX, -centerY);
    baseDrawSeedMan();
    ctx.restore();
  };

  const baseRender = render;
  render = function gameplayV2Render() {
    if (!ctx || !canvas) return baseRender();
    const activeShake = shakeTime > 0 ? shakeMagnitude * Math.min(1, shakeTime * 8) : 0;
    const ox = activeShake ? (Math.random() * 2 - 1) * activeShake : 0;
    const oy = activeShake ? (Math.random() * 2 - 1) * activeShake * 0.55 : 0;
    ctx.save();
    ctx.translate(Math.round(ox), Math.round(oy));
    baseRender();
    if (!paused) drawParticles();
    ctx.restore();
    if (flashTime > 0) {
      ctx.save();
      ctx.globalAlpha = Math.max(0, Math.min(1, flashTime / Math.max(0.001, flashDuration)));
      ctx.fillStyle = flashColor;
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.restore();
    }
  };

  resetGameplayV2();

  window.__SPROUT_GAMEPLAY_V2__ = Object.freeze({
    version: GAMEPLAY_VERSION,
    mechanics: Object.freeze(['moving-platforms', 'stompable-pests', 'bounce-pads', 'particles', 'screen-shake', 'squash-stretch']),
    snapshot: () => ({
      movingPlatforms: movingPlatforms.map(({ id, x, y, width, height, dx, dy }) => ({ id, x, y, width, height, dx, dy })),
      pests: pests.map(({ id, x, y, width, height, dead, dir }) => ({ id, x, y, width, height, dead, dir })),
      bouncePads: bouncePads.map((pad) => ({ ...pad })),
      particles: particles.length,
      stats: { ...stats }
    })
  });
})();