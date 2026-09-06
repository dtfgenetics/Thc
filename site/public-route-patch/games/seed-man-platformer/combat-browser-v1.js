'use strict';

(() => {
  const VERSION = 'seed-man-combat-browser-v1';
  const PLAYER_PROJECTILE_SIZE = 10;
  const ENEMIES = Object.freeze([
    { id: 'combat-aphid-01', name: 'Aphid Scout', x: 920, y: 450, minX: 820, maxX: 1120, width: 30, height: 28, health: 2, speed: 42, drop: ['resin', 2] },
    { id: 'combat-thrip-01', name: 'Thrip Dasher', x: 1760, y: 430, minX: 1640, maxX: 1880, width: 34, height: 24, health: 2, speed: 78, drop: ['trichomes', 2] },
    { id: 'combat-static-mite', name: 'Voltaic Mite', x: 2860, y: 448, minX: 2770, maxX: 3160, width: 34, height: 30, health: 4, speed: 54, elite: true, phenotype: 'static-haze', drop: ['genetic-fragments', 2] },
    { id: 'combat-gnat-01', name: 'Fungus Gnat', x: 4180, y: 340, minX: 4060, maxX: 4500, width: 32, height: 26, health: 3, speed: 66, flying: true, drop: ['nutrients', 3] },
    { id: 'combat-frost-aphid', name: 'Frost Aphid', x: 5660, y: 448, minX: 5520, maxX: 6030, width: 36, height: 30, health: 5, speed: 48, elite: true, phenotype: 'frost-resin', drop: ['trichomes', 4] },
    { id: 'combat-solar-thrip', name: 'Solar Thrip', x: 6920, y: 425, minX: 6860, maxX: 7300, width: 38, height: 28, health: 6, speed: 74, elite: true, phenotype: 'solar-flare', drop: ['alleles', 1] }
  ]);
  const PHENOTYPES = Object.freeze({
    'static-haze': { label: 'Static Haze', speed: 640, damage: 1, effect: 'chain', cooldown: 0.48 },
    'frost-resin': { label: 'Frost Resin', speed: 500, damage: 1, effect: 'freeze', cooldown: 0.42 },
    'solar-flare': { label: 'Solar Flare', speed: 540, damage: 2, effect: 'burn', cooldown: 0.52 }
  });

  let enemies = [];
  let projectiles = [];
  let facing = 1;
  let weaponCooldown = 0;
  let abilityCooldown = 0;
  let activePhenotype = null;
  let discoveredPhenotypes = [];
  let resources = {};
  let defeated = 0;
  let notice = null;
  let simTime = 0;

  const overlap = (a, b) => a.x < b.x + b.width && a.x + a.width > b.x && a.y < b.y + b.height && a.y + a.height > b.y;
  const cloneEnemy = (def, index) => ({ ...def, maxHealth: def.health, dir: index % 2 ? -1 : 1, defeated: false, hitFlash: 0, freeze: 0, burn: 0, burnTick: 0 });

  function resetCombat() {
    enemies = ENEMIES.map(cloneEnemy);
    projectiles = [];
    facing = 1;
    weaponCooldown = 0;
    abilityCooldown = 0;
    activePhenotype = null;
    discoveredPhenotypes = [];
    resources = { resin: 0, trichomes: 0, nutrients: 0, 'genetic-fragments': 0, alleles: 0 };
    defeated = 0;
    notice = { text: 'Seed Slinger ready · J / ATTACK', until: 2.4 };
    simTime = 0;
    syncHud();
  }

  function injectUi() {
    const hud = document.querySelector('.hud');
    if (hud && !document.querySelector('#combat-weapon-count')) {
      const weapon = document.createElement('span');
      weapon.innerHTML = 'Weapon <strong id="combat-weapon-count">Seed Slinger</strong>';
      const phenotype = document.createElement('span');
      phenotype.innerHTML = 'Phenotype <strong id="combat-phenotype-count">None</strong>';
      const resourcesEl = document.createElement('span');
      resourcesEl.innerHTML = 'Resources <strong id="combat-resource-count">0</strong>';
      hud.insertBefore(weapon, hud.querySelector('button'));
      hud.insertBefore(phenotype, hud.querySelector('button'));
      hud.insertBefore(resourcesEl, hud.querySelector('button'));
    }

    const touch = document.querySelector('.touch-controls');
    if (touch && !touch.querySelector('[data-combat="attack"]')) {
      const attack = document.createElement('button');
      attack.type = 'button';
      attack.dataset.combat = 'attack';
      attack.setAttribute('aria-label', 'Fire equipped weapon');
      attack.textContent = 'ATTACK';
      const ability = document.createElement('button');
      ability.type = 'button';
      ability.dataset.combat = 'ability';
      ability.setAttribute('aria-label', 'Use acquired phenotype ability');
      ability.textContent = 'PHENO';
      touch.append(attack, ability);
      attack.addEventListener('pointerdown', (event) => { event.preventDefault(); fireWeapon(); });
      ability.addEventListener('pointerdown', (event) => { event.preventDefault(); fireAbility(); });
    }

    if (!document.querySelector('#seed-combat-style')) {
      const style = document.createElement('style');
      style.id = 'seed-combat-style';
      style.textContent = `
        .touch-controls [data-combat]{min-width:76px;font-weight:900;letter-spacing:.04em}
        .touch-controls [data-combat="attack"]{border-color:rgba(243,200,103,.6)}
        .touch-controls [data-combat="ability"]{border-color:rgba(164,132,255,.62)}
        @media(max-width:680px){.touch-controls{flex-wrap:wrap}.touch-controls [data-combat]{min-height:64px;flex:1 1 30%}}
      `;
      document.head.append(style);
    }
  }

  function syncHud() {
    const phenotype = document.querySelector('#combat-phenotype-count');
    const resource = document.querySelector('#combat-resource-count');
    if (phenotype) phenotype.textContent = activePhenotype ? PHENOTYPES[activePhenotype]?.label || activePhenotype : 'None';
    if (resource) resource.textContent = String(Object.values(resources).reduce((sum, value) => sum + value, 0));
  }

  function setNotice(text, seconds = 1.8) {
    notice = { text, until: simTime + seconds };
  }

  function spawnProjectile({ speed, damage, effect = null, ability = false }) {
    if (!player || player.finished) return;
    const dir = facing < 0 ? -1 : 1;
    projectiles.push({
      id: `${ability ? 'ability' : 'seed'}-${simTime}-${projectiles.length}`,
      x: player.x + player.width / 2 + dir * 16,
      y: player.y + player.height * 0.46,
      width: PLAYER_PROJECTILE_SIZE,
      height: 7,
      vx: speed * dir,
      damage,
      effect,
      life: 1.6,
      ability
    });
  }

  function fireWeapon() {
    if (!player || paused || player.finished || weaponCooldown > 0) return false;
    weaponCooldown = 0.18;
    spawnProjectile({ speed: 560, damage: 1 });
    return true;
  }

  function fireAbility() {
    if (!player || paused || player.finished || abilityCooldown > 0) return false;
    const phenotype = PHENOTYPES[activePhenotype];
    if (!phenotype) {
      setNotice('Defeat an elite phenotype carrier first.');
      return false;
    }
    abilityCooldown = phenotype.cooldown;
    spawnProjectile({ speed: phenotype.speed, damage: phenotype.damage, effect: phenotype.effect, ability: true });
    return true;
  }

  function rewardEnemy(enemy) {
    defeated += 1;
    const [resource, amount] = enemy.drop || [];
    if (resource) resources[resource] = (resources[resource] || 0) + Math.max(0, Number(amount) || 0);
    if (enemy.phenotype) {
      activePhenotype = enemy.phenotype;
      if (!discoveredPhenotypes.includes(enemy.phenotype)) discoveredPhenotypes.push(enemy.phenotype);
      setNotice(`PHENOTYPE ACQUIRED · ${PHENOTYPES[enemy.phenotype]?.label || enemy.phenotype}`, 3.2);
    } else {
      setNotice(`${enemy.name} cleared · +${amount || 0} ${resource || 'resource'}`);
    }
    syncHud();
  }

  function damageEnemy(enemy, projectile) {
    if (enemy.defeated) return;
    enemy.health = Math.max(0, enemy.health - projectile.damage);
    enemy.hitFlash = 0.14;
    if (projectile.effect === 'freeze') enemy.freeze = Math.max(enemy.freeze, 2.25);
    if (projectile.effect === 'burn') {
      enemy.burn = Math.max(enemy.burn, 2.4);
      enemy.burnTick = Math.min(enemy.burnTick || 0.5, 0.5);
    }
    if (projectile.effect === 'chain') {
      const secondary = enemies.find((candidate) => !candidate.defeated && candidate.id !== enemy.id && Math.abs(candidate.x - enemy.x) < 190);
      if (secondary) {
        secondary.health = Math.max(0, secondary.health - 1);
        secondary.hitFlash = 0.14;
        if (secondary.health <= 0) { secondary.defeated = true; rewardEnemy(secondary); }
      }
    }
    if (enemy.health <= 0) {
      enemy.defeated = true;
      rewardEnemy(enemy);
    }
  }

  function tickCombat(dt) {
    const step = Math.max(0, Math.min(Number(dt) || 0, 0.05));
    simTime += step;
    weaponCooldown = Math.max(0, weaponCooldown - step);
    abilityCooldown = Math.max(0, abilityCooldown - step);
    if (player?.vx > 8) facing = 1;
    else if (player?.vx < -8) facing = -1;

    for (const enemy of enemies) {
      if (enemy.defeated) continue;
      enemy.hitFlash = Math.max(0, enemy.hitFlash - step);
      enemy.freeze = Math.max(0, enemy.freeze - step);
      if (enemy.burn > 0) {
        enemy.burn = Math.max(0, enemy.burn - step);
        enemy.burnTick -= step;
        if (enemy.burnTick <= 0) {
          enemy.burnTick = 0.5;
          enemy.health = Math.max(0, enemy.health - 1);
          enemy.hitFlash = 0.1;
          if (enemy.health <= 0) { enemy.defeated = true; rewardEnemy(enemy); continue; }
        }
      }
      if (enemy.freeze <= 0) {
        enemy.x += enemy.dir * enemy.speed * step;
        if (enemy.x <= enemy.minX) { enemy.x = enemy.minX; enemy.dir = 1; }
        if (enemy.x + enemy.width >= enemy.maxX) { enemy.x = enemy.maxX - enemy.width; enemy.dir = -1; }
        if (enemy.flying) enemy.y += Math.sin(simTime * 3 + enemy.x * 0.01) * 16 * step;
      }
    }

    for (const projectile of projectiles) {
      projectile.x += projectile.vx * step;
      projectile.life -= step;
      for (const enemy of enemies) {
        if (projectile.life <= 0 || enemy.defeated || !overlap(projectile, enemy)) continue;
        damageEnemy(enemy, projectile);
        projectile.life = 0;
      }
    }
    projectiles = projectiles.filter((projectile) => projectile.life > 0 && projectile.x > -100 && projectile.x < (level?.worldWidth || 8000) + 100);
  }

  function drawEnemy(enemy) {
    if (enemy.defeated) return;
    const x = enemy.x - cameraX;
    const y = enemy.y;
    const elite = Boolean(enemy.elite);
    ctx.save();
    ctx.translate(x + enemy.width / 2, y + enemy.height / 2);
    ctx.scale(enemy.dir, 1);
    ctx.fillStyle = enemy.hitFlash > 0 ? '#ffffff' : elite ? '#6c4ed8' : enemy.flying ? '#ad7b47' : '#789d45';
    ctx.strokeStyle = '#162019';
    ctx.lineWidth = elite ? 3 : 2;
    ctx.beginPath();
    ctx.ellipse(0, 0, enemy.width * 0.38, enemy.height * 0.34, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    if (elite) {
      ctx.strokeStyle = enemy.phenotype === 'solar-flare' ? '#ff9a4b' : enemy.phenotype === 'frost-resin' ? '#8fe7ff' : '#d6c0ff';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(0, 0, enemy.width * 0.48 + Math.sin(simTime * 5) * 2, 0, Math.PI * 2);
      ctx.stroke();
    }
    if (enemy.freeze > 0) {
      ctx.strokeStyle = '#b8efff';
      ctx.strokeRect(-enemy.width / 2, -enemy.height / 2, enemy.width, enemy.height);
    }
    if (enemy.burn > 0) {
      ctx.fillStyle = '#ff8d43';
      ctx.beginPath();
      ctx.moveTo(-4, -enemy.height / 2);
      ctx.lineTo(0, -enemy.height / 2 - 10);
      ctx.lineTo(5, -enemy.height / 2);
      ctx.fill();
    }
    ctx.restore();

    const barWidth = Math.max(24, enemy.width);
    ctx.fillStyle = 'rgba(10,20,14,.72)';
    ctx.fillRect(x, y - 9, barWidth, 5);
    ctx.fillStyle = elite ? '#c8f36a' : '#8ed85f';
    ctx.fillRect(x, y - 9, barWidth * (enemy.health / enemy.maxHealth), 5);
  }

  function drawProjectile(projectile) {
    const x = projectile.x - cameraX;
    ctx.save();
    ctx.fillStyle = projectile.effect === 'burn' ? '#ff8d43' : projectile.effect === 'freeze' ? '#8fe7ff' : projectile.effect === 'chain' ? '#d2bcff' : '#e7d3a4';
    ctx.shadowBlur = projectile.ability ? 10 : 4;
    ctx.shadowColor = ctx.fillStyle;
    ctx.beginPath();
    ctx.ellipse(x + projectile.width / 2, projectile.y + projectile.height / 2, projectile.width / 2, projectile.height / 2, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  function drawCombat() {
    if (!ctx || !player) return;
    for (const enemy of enemies) drawEnemy(enemy);
    for (const projectile of projectiles) drawProjectile(projectile);
    if (notice && simTime < notice.until) {
      ctx.save();
      ctx.font = '900 13px system-ui';
      ctx.textAlign = 'center';
      const width = Math.min(canvas.width - 40, Math.max(240, ctx.measureText(notice.text).width + 32));
      ctx.fillStyle = 'rgba(7,22,15,.9)';
      ctx.fillRect((canvas.width - width) / 2, 18, width, 34);
      ctx.strokeStyle = '#c8f36a';
      ctx.strokeRect((canvas.width - width) / 2, 18, width, 34);
      ctx.fillStyle = '#f4f7ee';
      ctx.fillText(notice.text, canvas.width / 2, 40);
      ctx.restore();
    }
  }

  function installRuntimeHooks() {
    if (typeof stepPlayer !== 'function' || typeof render !== 'function' || typeof reset !== 'function') return false;
    const baseStep = stepPlayer;
    stepPlayer = function seedManCombatBrowserStep(inputPlayer, inputState, levelData, dt, config) {
      const next = baseStep(inputPlayer, inputState, levelData, dt, config);
      if (!paused && !next.finished) tickCombat(dt);
      return next;
    };

    const baseRender = render;
    render = function seedManCombatBrowserRender() {
      baseRender();
      drawCombat();
    };

    const baseReset = reset;
    reset = function seedManCombatBrowserReset() {
      baseReset();
      resetCombat();
    };
    return true;
  }

  window.addEventListener('keydown', (event) => {
    if (event.repeat) return;
    const key = event.key.toLowerCase();
    if (key === 'j' || key === 'x') { event.preventDefault(); fireWeapon(); }
    if (key === 'k' || key === 'c') { event.preventDefault(); fireAbility(); }
  }, { passive: false });

  injectUi();
  resetCombat();
  const installed = installRuntimeHooks();
  window.__SPROUT_COMBAT_BROWSER__ = Object.freeze({
    version: VERSION,
    installed,
    fireWeapon,
    fireAbility,
    snapshot: () => ({
      version: VERSION,
      installed,
      equippedWeapon: 'seed-slinger',
      activePhenotype,
      discoveredPhenotypes: [...discoveredPhenotypes],
      resources: { ...resources },
      defeated,
      projectiles: projectiles.map(({ x, y, vx, damage, effect, ability }) => ({ x, y, vx, damage, effect, ability })),
      enemies: enemies.map(({ id, name, health, maxHealth, defeated: isDefeated, phenotype, freeze, burn }) => ({ id, name, health, maxHealth, defeated: isDefeated, phenotype, freeze, burn }))
    })
  });
})();
