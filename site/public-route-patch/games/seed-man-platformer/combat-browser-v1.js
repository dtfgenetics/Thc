'use strict';

(() => {
  const VERSION = 'seed-man-combat-browser-v1';
  const PHENOTYPE_ABSORB_VERSION = 'seed-man-phenotype-absorb-v1';
  const PHENOTYPE_EXPANSION_VERSION = 'seed-man-phenotype-expansion-v1';
  const PHENOTYPE_DURATION = 30;
  const PLAYER_PROJECTILE_SIZE = 10;

  const PHENOTYPES = Object.freeze({
    'static-haze': { label: 'Static Haze', type: 'projectile', speed: 640, damage: 1, effect: 'chain', cooldown: 0.48, accent: '#d6c0ff' },
    'frost-resin': { label: 'Frost Resin', type: 'projectile', speed: 500, damage: 1, effect: 'freeze', cooldown: 0.42, accent: '#8fe7ff' },
    'solar-flare': { label: 'Solar Flare', type: 'projectile', speed: 540, damage: 2, effect: 'burn', cooldown: 0.52, accent: '#ff9a4b' },
    'hydro-surge': { label: 'Hydro Surge', type: 'bubble', cooldown: 2.4, duration: 5, accent: '#74d9ff' },
    'terpene-tempest': { label: 'Terpene Tempest', type: 'flight', cooldown: 2.8, duration: 4.5, accent: '#b9f5d0' },
    'vine-lash': { label: 'Vine Lash', type: 'melee', damage: 2, range: 118, cooldown: 0.45, accent: '#80d36b' },
    'mycelium-mind': { label: 'Mycelium Mind', type: 'projectile', speed: 330, damage: 1, effect: 'spore', cooldown: 0.58, accent: '#d2a6ff' },
    rootbreaker: { label: 'Rootbreaker', type: 'ground', damage: 2, range: 150, cooldown: 0.85, accent: '#c7905b' },
    'trichome-crystal': { label: 'Trichome Crystal', type: 'projectile', speed: 590, damage: 2, effect: 'pierce', cooldown: 0.56, accent: '#d9fbff' },
    'gravity-haze': { label: 'Gravity Haze', type: 'warp', distance: 280, cooldown: 1.8, accent: '#c59cff' }
  });

  const ENCOUNTERS = Object.freeze({
    'sprout-run': [
      { id: 'combat-aphid-01', name: 'Aphid Scout', x: 920, y: 450, minX: 820, maxX: 1120, width: 30, height: 28, health: 2, speed: 42, drop: ['resin', 2] },
      { id: 'combat-thrip-01', name: 'Thrip Dasher', x: 1760, y: 430, minX: 1640, maxX: 1880, width: 34, height: 24, health: 2, speed: 78, drop: ['trichomes', 2] },
      { id: 'combat-static-mite', name: 'Voltaic Mite', x: 2860, y: 448, minX: 2770, maxX: 3160, width: 34, height: 30, health: 4, speed: 54, elite: true, phenotype: 'static-haze', drop: ['genetic-fragments', 2] },
      { id: 'combat-gnat-01', name: 'Fungus Gnat', x: 4180, y: 340, minX: 4060, maxX: 4500, width: 32, height: 26, health: 3, speed: 66, flying: true, drop: ['nutrients', 3] },
      { id: 'combat-frost-aphid', name: 'Frost Aphid', x: 5660, y: 448, minX: 5520, maxX: 6030, width: 36, height: 30, health: 5, speed: 48, elite: true, phenotype: 'frost-resin', drop: ['trichomes', 4] },
      { id: 'combat-solar-thrip', name: 'Solar Thrip', x: 6920, y: 425, minX: 6860, maxX: 7300, width: 38, height: 28, health: 6, speed: 74, elite: true, phenotype: 'solar-flare', drop: ['alleles', 1] }
    ],
    'nursery-night-shift': [
      { id: 'nursery-gnat-a', name: 'Nursery Gnat', x: 1320, y: 330, minX: 1180, maxX: 1640, width: 32, height: 25, health: 3, speed: 72, flying: true, drop: ['nutrients', 2] },
      { id: 'nursery-hydro-beetle', name: 'Bubble Beetle', x: 3360, y: 446, minX: 3200, maxX: 3720, width: 42, height: 34, health: 7, speed: 48, elite: true, phenotype: 'hydro-surge', drop: ['resin', 3] },
      { id: 'nursery-aphid-brute', name: 'Aphid Brute', x: 6120, y: 430, minX: 5960, maxX: 6480, width: 58, height: 48, health: 14, speed: 44, bossRank: 'minor', telegraph: 0.65, drop: ['nutrients', 6] }
    ],
    'reservoir-run': [
      { id: 'reservoir-wasp-a', name: 'Pollen Wasp', x: 1540, y: 300, minX: 1380, maxX: 1920, width: 34, height: 25, health: 3, speed: 96, flying: true, drop: ['genetic-fragments', 2] },
      { id: 'reservoir-tempest-gnat', name: 'Tempest Gnat', x: 3820, y: 300, minX: 3600, maxX: 4260, width: 40, height: 30, health: 7, speed: 92, flying: true, elite: true, phenotype: 'terpene-tempest', drop: ['alleles', 1] },
      { id: 'reservoir-hornet', name: 'Tempest Hornet', x: 6420, y: 285, minX: 6180, maxX: 6940, width: 64, height: 44, health: 16, speed: 86, flying: true, bossRank: 'minor', telegraph: 0.7, phenotype: 'terpene-tempest', drop: ['genetic-fragments', 6] }
    ],
    'root-zone-rumble': [
      { id: 'root-borer', name: 'Root Borer', x: 3020, y: 438, minX: 2840, maxX: 3460, width: 46, height: 38, health: 9, speed: 40, elite: true, phenotype: 'rootbreaker', drop: ['nutrients', 4] },
      { id: 'vine-weevil', name: 'Vine Weevil', x: 5660, y: 442, minX: 5480, maxX: 6040, width: 42, height: 36, health: 8, speed: 44, elite: true, phenotype: 'vine-lash', drop: ['resin', 2] }
    ],
    'mycelium-mile': [
      { id: 'mycelium-moth', name: 'Mycelium Moth', x: 2860, y: 305, minX: 2660, maxX: 3300, width: 44, height: 32, health: 8, speed: 78, flying: true, elite: true, phenotype: 'mycelium-mind', drop: ['nutrients', 3] },
      { id: 'spore-seraph', name: 'Spore Seraph', x: 6400, y: 270, minX: 6120, maxX: 7040, width: 82, height: 60, health: 30, speed: 72, flying: true, bossRank: 'major', phases: 3, telegraph: 1, phenotype: 'mycelium-mind', drop: ['alleles', 3] }
    ],
    'trichome-transit': [
      { id: 'crystal-mite', name: 'Crystal Mite', x: 3520, y: 440, minX: 3300, maxX: 3920, width: 42, height: 36, health: 9, speed: 58, elite: true, phenotype: 'trichome-crystal', drop: ['trichomes', 5] },
      { id: 'resin-golem', name: 'Resin Golem', x: 6460, y: 420, minX: 6240, maxX: 6920, width: 62, height: 58, health: 18, speed: 34, bossRank: 'minor', telegraph: 0.8, phenotype: 'trichome-crystal', drop: ['resin', 7] }
    ],
    'kief-cavern-climb': [
      { id: 'cavern-wasp', name: 'Crystal Wasp', x: 2820, y: 270, minX: 2600, maxX: 3240, width: 34, height: 25, health: 4, speed: 92, flying: true, drop: ['trichomes', 3] },
      { id: 'cavern-vine', name: 'Cave Vine Weevil', x: 5400, y: 420, minX: 5200, maxX: 5840, width: 42, height: 36, health: 8, speed: 44, elite: true, phenotype: 'vine-lash', drop: ['resin', 3] }
    ],
    'rosin-refinery-rush': [
      { id: 'refinery-solar', name: 'Solar Fungus', x: 3600, y: 430, minX: 3420, maxX: 3980, width: 44, height: 40, health: 8, speed: 36, elite: true, phenotype: 'solar-flare', drop: ['resin', 4] },
      { id: 'queen-mite', name: 'Queen Mite', x: 6500, y: 410, minX: 6240, maxX: 7040, width: 78, height: 66, health: 28, speed: 44, bossRank: 'major', phases: 3, telegraph: 0.9, phenotype: 'static-haze', drop: ['trichomes', 10] }
    ],
    'terpene-tunnel': [
      { id: 'tunnel-tempest', name: 'Tempest Gnat', x: 3200, y: 285, minX: 2960, maxX: 3620, width: 40, height: 30, health: 7, speed: 92, flying: true, elite: true, phenotype: 'terpene-tempest', drop: ['alleles', 2] },
      { id: 'tunnel-moth', name: 'Spore Moth', x: 5680, y: 300, minX: 5480, maxX: 6080, width: 44, height: 32, health: 8, speed: 78, flying: true, elite: true, phenotype: 'mycelium-mind', drop: ['nutrients', 3] }
    ],
    'frostline-canopy': [
      { id: 'canopy-frost', name: 'Frost Aphid', x: 3260, y: 438, minX: 3060, maxX: 3660, width: 40, height: 34, health: 7, speed: 54, elite: true, phenotype: 'frost-resin', drop: ['resin', 3] },
      { id: 'canopy-wasp', name: 'Frost Wasp', x: 5680, y: 270, minX: 5440, maxX: 6160, width: 36, height: 26, health: 5, speed: 94, flying: true, drop: ['trichomes', 4] }
    ],
    'cloud-nine-citadel': [
      { id: 'citadel-warp-midge', name: 'Gravity Midge', x: 2800, y: 300, minX: 2520, maxX: 3380, width: 38, height: 30, health: 8, speed: 70, blink: true, elite: true, phenotype: 'gravity-haze', drop: ['alleles', 2] },
      { id: 'warp-weaver', name: 'Warp Weaver', x: 6420, y: 300, minX: 6040, maxX: 7100, width: 80, height: 62, health: 32, speed: 62, blink: true, bossRank: 'major', phases: 4, telegraph: 0.85, phenotype: 'gravity-haze', drop: ['genetic-fragments', 10] }
    ]
  });

  let enemies = [];
  let projectiles = [];
  let facing = 1;
  let weaponCooldown = 0;
  let abilityCooldown = 0;
  let activePhenotype = null;
  let phenotypeRemaining = 0;
  let specialTimer = 0;
  let bubbleHits = 0;
  let discoveredPhenotypes = [];
  let resources = {};
  let defeated = 0;
  let notice = null;
  let simTime = 0;
  let activeLevelId = '';

  const overlap = (a, b) => a.x < b.x + b.width && a.x + a.width > b.x && a.y < b.y + b.height && a.y + a.height > b.y;
  const emptyResources = () => ({ resin: 0, trichomes: 0, nutrients: 0, 'genetic-fragments': 0, alleles: 0 });
  const clamp = (value, min, max) => Math.max(min, Math.min(max, value));

  function encounterDefinitions() {
    return ENCOUNTERS[level?.id] || ENCOUNTERS['sprout-run'];
  }

  function cloneEnemy(def, index) {
    return {
      ...def,
      maxHealth: def.health,
      dir: index % 2 ? -1 : 1,
      defeated: false,
      hitFlash: 0,
      freeze: 0,
      burn: 0,
      burnTick: 0,
      baseY: def.y,
      phaseClock: 0,
      blinkClock: 1.4 + index * 0.25,
      telegraphClock: 0
    };
  }

  function resetCombat({ preserveProgression = true } = {}) {
    const savedDiscoveries = preserveProgression ? [...discoveredPhenotypes] : [];
    const savedResources = preserveProgression ? { ...emptyResources(), ...resources } : emptyResources();
    activeLevelId = level?.id || 'sprout-run';
    enemies = encounterDefinitions().map(cloneEnemy);
    projectiles = [];
    facing = 1;
    weaponCooldown = 0;
    abilityCooldown = 0;
    activePhenotype = null;
    phenotypeRemaining = 0;
    specialTimer = 0;
    bubbleHits = 0;
    discoveredPhenotypes = savedDiscoveries;
    resources = savedResources;
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
      phenotype.className = 'combat-pheno-chip';
      phenotype.innerHTML = 'Pheno <strong id="combat-phenotype-count">None</strong> <em id="combat-phenotype-time" aria-live="polite"></em>';
      const threat = document.createElement('span');
      threat.className = 'combat-threat-chip';
      threat.innerHTML = 'Threat <strong id="combat-threat-count">Clear</strong>';
      const resourcesEl = document.createElement('span');
      resourcesEl.innerHTML = 'Resources <strong id="combat-resource-count">0</strong>';
      hud.append(weapon, phenotype, threat, resourcesEl);
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
      ability.setAttribute('aria-label', 'Use absorbed phenotype ability');
      ability.textContent = 'PHENO';
      touch.append(attack, ability);
      attack.addEventListener('pointerdown', (event) => { event.preventDefault(); fireWeapon(); });
      ability.addEventListener('pointerdown', (event) => { event.preventDefault(); fireAbility(); });
    }

    if (!document.querySelector('#seed-combat-style')) {
      const style = document.createElement('style');
      style.id = 'seed-combat-style';
      style.textContent = `
        .combat-pheno-chip strong,.combat-threat-chip strong{font-weight:900}.combat-pheno-chip em{font-style:normal;font-weight:900;opacity:.86}
        html[data-seed-pheno-active="true"] .combat-pheno-chip{outline:1px solid color-mix(in srgb,var(--seed-pheno-accent,#c8f36a) 70%,transparent);box-shadow:inset 0 0 0 1px rgba(255,255,255,.05)}
        html[data-seed-special-active="true"] .combat-pheno-chip{box-shadow:0 0 18px color-mix(in srgb,var(--seed-pheno-accent,#c8f36a) 28%,transparent)}
        .combat-threat-chip strong[data-rank="minor"]{color:#f3c867}.combat-threat-chip strong[data-rank="major"]{color:#ff9d86}
        .touch-controls [data-combat]{min-width:82px;min-height:58px;font-weight:900;letter-spacing:.04em}
        .touch-controls [data-combat="attack"]{border-color:rgba(243,200,103,.6)}
        .touch-controls [data-combat="ability"]{border-color:var(--seed-pheno-accent,rgba(164,132,255,.62))}
        html[data-seed-pheno-active="true"] .touch-controls [data-combat="ability"]{box-shadow:0 0 0 2px color-mix(in srgb,var(--seed-pheno-accent,#c8f36a) 35%,transparent)}
        @media(max-width:680px){.touch-controls{flex-wrap:wrap;gap:10px}.touch-controls [data-combat]{min-height:64px;flex:1 1 30%}.combat-threat-chip{display:none}}
        @media(prefers-reduced-motion:reduce){html[data-seed-pheno-active="true"] .touch-controls [data-combat="ability"],html[data-seed-special-active="true"] .combat-pheno-chip{box-shadow:none}}
      `;
      document.head.append(style);
    }
  }

  function currentBoss() {
    return enemies.find((enemy) => !enemy.defeated && enemy.bossRank) || null;
  }

  function syncHud() {
    const phenotype = document.querySelector('#combat-phenotype-count');
    const timer = document.querySelector('#combat-phenotype-time');
    const resource = document.querySelector('#combat-resource-count');
    const ability = document.querySelector('[data-combat="ability"]');
    const threat = document.querySelector('#combat-threat-count');
    const def = activePhenotype ? PHENOTYPES[activePhenotype] : null;
    const boss = currentBoss();
    if (phenotype) phenotype.textContent = def?.label || 'None';
    if (timer) timer.textContent = activePhenotype ? `${Math.ceil(phenotypeRemaining)}s` : '';
    if (resource) resource.textContent = String(Object.values(resources).reduce((sum, value) => sum + value, 0));
    if (ability) ability.textContent = activePhenotype ? `${def?.type === 'flight' ? 'FLY' : def?.type === 'bubble' ? 'BUBBLE' : def?.type === 'warp' ? 'WARP' : 'PHENO'} ${Math.ceil(phenotypeRemaining)}` : 'PHENO';
    if (threat) {
      threat.textContent = boss ? `${boss.name} ${boss.health}/${boss.maxHealth}` : `${enemies.filter((enemy) => !enemy.defeated).length} left`;
      threat.dataset.rank = boss?.bossRank || 'standard';
    }
    document.documentElement.dataset.seedPhenoActive = activePhenotype ? 'true' : 'false';
    document.documentElement.dataset.seedSpecialActive = specialTimer > 0 ? 'true' : 'false';
    if (def?.accent) document.documentElement.style.setProperty('--seed-pheno-accent', def.accent);
    else document.documentElement.style.removeProperty('--seed-pheno-accent');
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
      ability,
      pierce: effect === 'pierce' ? 2 : 0
    });
  }

  function fireWeapon() {
    if (!player || paused || player.finished || weaponCooldown > 0) return false;
    weaponCooldown = 0.18;
    spawnProjectile({ speed: 560, damage: 1 });
    return true;
  }

  function enemiesInFront(range) {
    const center = player.x + player.width / 2;
    return enemies.filter((enemy) => {
      if (enemy.defeated) return false;
      const enemyCenter = enemy.x + enemy.width / 2;
      const forward = (enemyCenter - center) * facing;
      return forward >= -10 && forward <= range && Math.abs((enemy.y + enemy.height / 2) - (player.y + player.height / 2)) < 90;
    });
  }

  function fireAbility() {
    if (!player || paused || player.finished || abilityCooldown > 0) return false;
    const phenotype = PHENOTYPES[activePhenotype];
    if (!phenotype || phenotypeRemaining <= 0) {
      setNotice('Defeat an elite phenotype carrier to absorb its power for 30s.');
      return false;
    }
    abilityCooldown = phenotype.cooldown;

    if (phenotype.type === 'flight') {
      specialTimer = phenotype.duration;
      setNotice(`${phenotype.label} · FLIGHT BURST`, 1.2);
    } else if (phenotype.type === 'bubble') {
      specialTimer = phenotype.duration;
      bubbleHits = 1;
      setNotice(`${phenotype.label} · BUBBLE FORM`, 1.2);
    } else if (phenotype.type === 'warp') {
      const before = player.x;
      player.x = clamp(player.x + facing * phenotype.distance, 0, Math.max(0, (level?.worldWidth || 8000) - player.width));
      player.power = player.power || {};
      player.power.invulnerableTimer = Math.max(player.power.invulnerableTimer || 0, 0.22);
      specialTimer = 0.3;
      setNotice(`${phenotype.label} · WARP ${Math.round(Math.abs(player.x - before))}px`, 1.1);
    } else if (phenotype.type === 'melee') {
      const targets = enemiesInFront(phenotype.range);
      for (const enemy of targets.slice(0, 2)) {
        damageEnemy(enemy, { damage: phenotype.damage, effect: 'vine', vx: facing * 220, ability: true });
        enemy.x -= facing * 34;
      }
      setNotice(`${phenotype.label} · VINE WHIP`, 0.8);
    } else if (phenotype.type === 'ground') {
      const center = player.x + player.width / 2;
      for (const enemy of enemies) {
        if (enemy.defeated || Math.abs((enemy.x + enemy.width / 2) - center) > phenotype.range) continue;
        damageEnemy(enemy, { damage: phenotype.damage, effect: 'root', vx: 0, ability: true });
        enemy.y -= 22;
      }
      setNotice(`${phenotype.label} · ROOT ERUPTION`, 0.8);
    } else {
      spawnProjectile({ speed: phenotype.speed, damage: phenotype.damage, effect: phenotype.effect, ability: true });
      setNotice(`${phenotype.label} · ${Math.ceil(phenotypeRemaining)}s`, 0.8);
    }
    syncHud();
    return true;
  }

  function rewardEnemy(enemy) {
    defeated += 1;
    const [resource, amount] = enemy.drop || [];
    if (resource) resources[resource] = (resources[resource] || 0) + Math.max(0, Number(amount) || 0);
    if (enemy.phenotype) {
      activePhenotype = enemy.phenotype;
      phenotypeRemaining = PHENOTYPE_DURATION;
      specialTimer = 0;
      bubbleHits = 0;
      if (!discoveredPhenotypes.includes(enemy.phenotype)) discoveredPhenotypes.push(enemy.phenotype);
      setNotice(`PHENO ABSORBED · ${PHENOTYPES[enemy.phenotype]?.label || enemy.phenotype} · 30s`, 3.2);
    } else if (enemy.bossRank) {
      setNotice(`${enemy.bossRank === 'major' ? 'MAJOR' : 'MINOR'} BOSS DOWN · ${enemy.name}`, 2.4);
    } else {
      setNotice(`${enemy.name} cleared · +${amount || 0} ${resource || 'resource'}`);
    }
    syncHud();
  }

  function damageEnemy(enemy, projectile) {
    if (enemy.defeated) return;
    enemy.health = Math.max(0, enemy.health - Math.max(0, Number(projectile.damage) || 0));
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

  function tickPhenotype(step) {
    if (!activePhenotype) return;
    phenotypeRemaining = Math.max(0, phenotypeRemaining - step);
    specialTimer = Math.max(0, specialTimer - step);
    if (phenotypeRemaining <= 0) {
      const expired = PHENOTYPES[activePhenotype]?.label || activePhenotype;
      activePhenotype = null;
      abilityCooldown = 0;
      specialTimer = 0;
      bubbleHits = 0;
      setNotice(`${expired} faded · absorb another elite power`, 2.1);
    }
    syncHud();
  }

  function tickSpecialPlayerState(inputState, step) {
    if (!player || specialTimer <= 0 || !activePhenotype) return;
    const phenotype = PHENOTYPES[activePhenotype];
    if (phenotype?.type === 'flight') {
      const wantsLift = Boolean(inputState?.jumpHeld || inputState?.jumpPressed);
      if (wantsLift) player.vy = Math.max(-360, (player.vy || 0) - 930 * step);
      else player.vy = Math.min(95, (player.vy || 0) * 0.7);
      player.grounded = false;
    } else if (phenotype?.type === 'bubble') {
      player.vy = Math.min(120, (player.vy || 0) * 0.82);
      player.power = player.power || {};
      if (bubbleHits > 0) player.power.invulnerableTimer = Math.max(player.power.invulnerableTimer || 0, 0.12);
    }
  }

  function tickEnemy(enemy, step) {
    enemy.hitFlash = Math.max(0, enemy.hitFlash - step);
    enemy.freeze = Math.max(0, enemy.freeze - step);
    enemy.phaseClock += step;
    enemy.telegraphClock = Math.max(0, enemy.telegraphClock - step);
    if (enemy.burn > 0) {
      enemy.burn = Math.max(0, enemy.burn - step);
      enemy.burnTick -= step;
      if (enemy.burnTick <= 0) {
        enemy.burnTick = 0.5;
        enemy.health = Math.max(0, enemy.health - 1);
        enemy.hitFlash = 0.1;
        if (enemy.health <= 0) { enemy.defeated = true; rewardEnemy(enemy); return; }
      }
    }
    if (enemy.freeze > 0) return;

    if (enemy.blink) {
      enemy.blinkClock -= step;
      if (enemy.blinkClock <= 0.34 && enemy.blinkClock > 0) enemy.telegraphClock = Math.max(enemy.telegraphClock, enemy.blinkClock);
      if (enemy.blinkClock <= 0) {
        const span = Math.max(80, enemy.maxX - enemy.minX - enemy.width);
        enemy.x = clamp(enemy.x + enemy.dir * Math.min(180, span * 0.45), enemy.minX, enemy.maxX - enemy.width);
        enemy.dir *= -1;
        enemy.blinkClock = enemy.bossRank ? 1.25 : 1.8;
      }
    } else {
      enemy.x += enemy.dir * enemy.speed * step;
      if (enemy.x <= enemy.minX) { enemy.x = enemy.minX; enemy.dir = 1; }
      if (enemy.x + enemy.width >= enemy.maxX) { enemy.x = enemy.maxX - enemy.width; enemy.dir = -1; }
    }

    if (enemy.flying) {
      const amplitude = enemy.bossRank ? 42 : enemy.elite ? 30 : 20;
      enemy.y = enemy.baseY + Math.sin(simTime * (enemy.bossRank ? 1.9 : 2.7) + enemy.x * 0.008) * amplitude;
    }

    if (enemy.bossRank && enemy.telegraph && enemy.phaseClock > 3.2) {
      enemy.telegraphClock = enemy.telegraph;
      enemy.phaseClock = 0;
    }
  }

  function tickCombat(dt, inputState = null) {
    const step = Math.max(0, Math.min(Number(dt) || 0, 0.05));
    if ((level?.id || 'sprout-run') !== activeLevelId) resetCombat();
    simTime += step;
    weaponCooldown = Math.max(0, weaponCooldown - step);
    abilityCooldown = Math.max(0, abilityCooldown - step);
    tickPhenotype(step);
    tickSpecialPlayerState(inputState, step);
    if (player?.vx > 8) facing = 1;
    else if (player?.vx < -8) facing = -1;

    for (const enemy of enemies) {
      if (!enemy.defeated) tickEnemy(enemy, step);
    }

    for (const projectile of projectiles) {
      projectile.x += projectile.vx * step;
      projectile.life -= step;
      for (const enemy of enemies) {
        if (projectile.life <= 0 || enemy.defeated || !overlap(projectile, enemy)) continue;
        damageEnemy(enemy, projectile);
        if (projectile.pierce > 0) projectile.pierce -= 1;
        else projectile.life = 0;
      }
    }
    projectiles = projectiles.filter((projectile) => projectile.life > 0 && projectile.x > -100 && projectile.x < (level?.worldWidth || 8000) + 100);
    syncHud();
  }

  function drawEnemy(enemy) {
    if (enemy.defeated) return;
    const x = enemy.x - cameraX;
    const y = enemy.y;
    const elite = Boolean(enemy.elite);
    const boss = Boolean(enemy.bossRank);
    ctx.save();
    ctx.translate(x + enemy.width / 2, y + enemy.height / 2);
    ctx.scale(enemy.dir, 1);
    if (enemy.telegraphClock > 0) {
      ctx.globalAlpha = 0.28 + Math.abs(Math.sin(simTime * 18)) * 0.35;
      ctx.fillStyle = '#ffcf76';
      ctx.beginPath();
      ctx.arc(0, 0, Math.max(enemy.width, enemy.height) * 0.72, 0, Math.PI * 2);
      ctx.fill();
      ctx.globalAlpha = 1;
    }
    if (enemy.flying) {
      ctx.fillStyle = 'rgba(235,248,229,.76)';
      ctx.beginPath(); ctx.ellipse(-enemy.width * 0.22, -enemy.height * 0.12, enemy.width * 0.3, enemy.height * 0.22, -0.35, 0, Math.PI * 2); ctx.fill();
      ctx.beginPath(); ctx.ellipse(enemy.width * 0.22, -enemy.height * 0.12, enemy.width * 0.3, enemy.height * 0.22, 0.35, 0, Math.PI * 2); ctx.fill();
    }
    ctx.fillStyle = enemy.hitFlash > 0 ? '#ffffff' : boss ? '#8f4168' : elite ? '#6c4ed8' : enemy.flying ? '#ad7b47' : '#789d45';
    ctx.strokeStyle = '#162019';
    ctx.lineWidth = boss ? 4 : elite ? 3 : 2;
    ctx.beginPath();
    ctx.ellipse(0, 0, enemy.width * 0.38, enemy.height * 0.34, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    if (boss) {
      ctx.fillStyle = '#f3c867';
      ctx.beginPath();
      ctx.moveTo(-12, -enemy.height * 0.28); ctx.lineTo(-6, -enemy.height * 0.55); ctx.lineTo(0, -enemy.height * 0.3); ctx.lineTo(7, -enemy.height * 0.56); ctx.lineTo(13, -enemy.height * 0.28); ctx.closePath(); ctx.fill();
    }
    if (elite || boss) {
      ctx.strokeStyle = PHENOTYPES[enemy.phenotype]?.accent || '#c8f36a';
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
      ctx.beginPath(); ctx.moveTo(-4, -enemy.height / 2); ctx.lineTo(0, -enemy.height / 2 - 10); ctx.lineTo(5, -enemy.height / 2); ctx.fill();
    }
    ctx.restore();

    const barWidth = Math.max(24, enemy.width);
    ctx.fillStyle = 'rgba(10,20,14,.72)';
    ctx.fillRect(x, y - 10, barWidth, boss ? 7 : 5);
    ctx.fillStyle = boss ? '#ff9d86' : elite ? '#c8f36a' : '#8ed85f';
    ctx.fillRect(x, y - 10, barWidth * (enemy.health / enemy.maxHealth), boss ? 7 : 5);
    if (boss) {
      ctx.font = '900 11px system-ui';
      ctx.fillStyle = '#f4f7ee';
      ctx.textAlign = 'center';
      ctx.fillText(`${enemy.bossRank === 'major' ? 'MAJOR' : 'MINOR'} · ${enemy.name}`, x + enemy.width / 2, y - 17);
    }
  }

  function drawProjectile(projectile) {
    const x = projectile.x - cameraX;
    ctx.save();
    ctx.fillStyle = projectile.effect === 'burn' ? '#ff8d43' : projectile.effect === 'freeze' ? '#8fe7ff' : projectile.effect === 'chain' ? '#d2bcff' : projectile.effect === 'spore' ? '#d2a6ff' : projectile.effect === 'pierce' ? '#d9fbff' : '#e7d3a4';
    ctx.shadowBlur = projectile.ability ? 10 : 4;
    ctx.shadowColor = ctx.fillStyle;
    ctx.beginPath();
    ctx.ellipse(x + projectile.width / 2, projectile.y + projectile.height / 2, projectile.width / 2, projectile.height / 2, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  function drawPhenotypeFormFx() {
    if (!activePhenotype || !player || phenotypeRemaining <= 0) return;
    const def = PHENOTYPES[activePhenotype];
    const px = player.x - cameraX + player.width / 2;
    const py = player.y + player.height / 2;
    const pulse = 1 + Math.sin(simTime * 10) * 0.08;
    ctx.save();
    ctx.globalAlpha = 0.55;
    ctx.strokeStyle = def.accent;
    ctx.lineWidth = specialTimer > 0 ? 4 : 3;
    ctx.shadowBlur = specialTimer > 0 ? 20 : 14;
    ctx.shadowColor = def.accent;
    ctx.beginPath();
    if (def.type === 'bubble' && specialTimer > 0) ctx.arc(px, py, Math.max(player.width, player.height) * 0.72 * pulse, 0, Math.PI * 2);
    else ctx.ellipse(px, py, player.width * 0.72 * pulse, player.height * 0.68 * pulse, 0, 0, Math.PI * 2);
    ctx.stroke();
    if (def.type === 'flight' && specialTimer > 0) {
      ctx.globalAlpha = 0.3;
      for (let i = 0; i < 4; i += 1) {
        ctx.beginPath();
        ctx.moveTo(px - 12 + i * 8, py + player.height * 0.35);
        ctx.lineTo(px - 18 + i * 8, py + player.height * 0.72 + Math.sin(simTime * 12 + i) * 8);
        ctx.stroke();
      }
    }
    const speed = Math.abs(player.vx || 0);
    if (speed > 80 || (def.type === 'warp' && specialTimer > 0)) {
      ctx.globalAlpha = 0.22;
      for (let i = 1; i <= 3; i += 1) {
        const trailX = px - Math.sign(player.vx || facing) * i * (9 + Math.max(speed, 160) * 0.012);
        ctx.beginPath();
        ctx.ellipse(trailX, py, player.width * (0.46 - i * 0.07), player.height * (0.44 - i * 0.06), 0, 0, Math.PI * 2);
        ctx.stroke();
      }
    }
    ctx.restore();
  }

  function drawCombat() {
    if (!ctx || !player) return;
    drawPhenotypeFormFx();
    for (const enemy of enemies) drawEnemy(enemy);
    for (const projectile of projectiles) drawProjectile(projectile);
    if (notice && simTime < notice.until) {
      ctx.save();
      ctx.font = '900 13px system-ui';
      ctx.textAlign = 'center';
      const width = Math.min(canvas.width - 40, Math.max(240, ctx.measureText(notice.text).width + 32));
      ctx.fillStyle = 'rgba(7,22,15,.9)';
      ctx.fillRect((canvas.width - width) / 2, 18, width, 34);
      ctx.strokeStyle = activePhenotype ? PHENOTYPES[activePhenotype]?.accent || '#c8f36a' : '#c8f36a';
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
      if (!paused && !next.finished) tickCombat(dt, inputState);
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
  resetCombat({ preserveProgression: false });
  const installed = installRuntimeHooks();
  window.__SPROUT_COMBAT_BROWSER__ = Object.freeze({
    version: VERSION,
    phenotypeAbsorbVersion: PHENOTYPE_ABSORB_VERSION,
    phenotypeExpansionVersion: PHENOTYPE_EXPANSION_VERSION,
    installed,
    fireWeapon,
    fireAbility,
    snapshot: () => ({
      version: VERSION,
      phenotypeAbsorbVersion: PHENOTYPE_ABSORB_VERSION,
      phenotypeExpansionVersion: PHENOTYPE_EXPANSION_VERSION,
      installed,
      levelId: activeLevelId,
      equippedWeapon: 'seed-slinger',
      activePhenotype,
      phenotypeRemaining,
      specialTimer,
      bubbleHits,
      discoveredPhenotypes: [...discoveredPhenotypes],
      resources: { ...resources },
      defeated,
      projectiles: projectiles.map(({ x, y, vx, damage, effect, ability }) => ({ x, y, vx, damage, effect, ability })),
      enemies: enemies.map(({ id, name, health, maxHealth, defeated: isDefeated, phenotype, freeze, burn, flying, blink, bossRank, telegraphClock }) => ({ id, name, health, maxHealth, defeated: isDefeated, phenotype, freeze, burn, flying: Boolean(flying), blink: Boolean(blink), bossRank: bossRank || null, telegraphClock }))
    })
  });
})();