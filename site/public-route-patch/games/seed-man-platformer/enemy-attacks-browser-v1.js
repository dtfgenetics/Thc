'use strict';

(async () => {
  const VERSION = 'seed-man-enemy-attacks-browser-v1';
  const HIT_INVULN = 0.85;
  const attackApi = await import('./enemy-attacks.mjs');
  const { createEnemyAttackState, stepEnemyAttack, advanceEnemyProjectile, overlapsRect } = attackApi;

  const LEVEL_ATTACKERS = Object.freeze({
    'sprout-run': [
      ['combat-thrip-01','Thrip Dasher',1760,430,1640,1880,34,24,78,'aimed-shot','standard'],
      ['combat-static-mite','Voltaic Mite',2860,448,2770,3160,34,30,54,'burst-shot','elite'],
      ['combat-gnat-01','Fungus Gnat',4180,340,4060,4500,32,26,66,'aimed-shot','standard','flying'],
      ['combat-frost-aphid','Frost Aphid',5660,448,5520,6030,36,30,48,'aimed-shot','elite'],
      ['combat-solar-thrip','Solar Thrip',6920,425,6860,7300,38,28,74,'ground-wave','elite']
    ],
    'nursery-night-shift': [
      ['nursery-gnat-a','Nursery Gnat',1320,330,1180,1640,32,25,72,'aimed-shot','standard','flying'],
      ['nursery-hydro-beetle','Bubble Beetle',3360,446,3200,3720,42,34,48,'burst-shot','elite'],
      ['nursery-aphid-brute','Aphid Brute',6120,430,5960,6480,58,48,44,'dive-charge','minor-boss']
    ],
    'reservoir-run': [
      ['reservoir-wasp-a','Pollen Wasp',1540,300,1380,1920,34,25,96,'dive-charge','standard','flying'],
      ['reservoir-tempest-gnat','Tempest Gnat',3820,300,3600,4260,40,30,92,'dive-charge','elite','flying'],
      ['reservoir-hornet','Tempest Hornet',6420,285,6180,6940,64,44,86,'dive-charge','minor-boss','flying']
    ],
    'root-zone-rumble': [
      ['root-borer','Root Borer',3020,438,2840,3460,46,38,40,'ground-wave','elite'],
      ['vine-weevil','Vine Weevil',5660,442,5480,6040,42,36,44,'ground-wave','elite']
    ],
    'mycelium-mile': [
      ['mycelium-moth','Mycelium Moth',2860,305,2660,3300,44,32,78,'burst-shot','elite','flying'],
      ['spore-seraph','Spore Seraph',6400,270,6120,7040,82,60,72,'radial-burst','major-boss','flying']
    ],
    'trichome-transit': [
      ['crystal-mite','Crystal Mite',3520,440,3300,3920,42,36,58,'burst-shot','elite'],
      ['resin-golem','Resin Golem',6460,420,6240,6920,62,58,34,'ground-wave','minor-boss']
    ],
    'kief-cavern-climb': [
      ['cavern-wasp','Crystal Wasp',2820,270,2600,3240,34,25,92,'dive-charge','standard','flying'],
      ['cavern-vine','Cave Vine Weevil',5400,420,5200,5840,42,36,44,'ground-wave','elite']
    ],
    'rosin-refinery-rush': [
      ['refinery-solar','Solar Fungus',3600,430,3420,3980,44,40,36,'ground-wave','elite'],
      ['queen-mite','Queen Mite',6500,410,6240,7040,78,66,44,'burst-shot','major-boss']
    ],
    'terpene-tunnel': [
      ['tunnel-tempest','Tempest Gnat',3200,285,2960,3620,40,30,92,'dive-charge','elite','flying'],
      ['tunnel-moth','Spore Moth',5680,300,5480,6080,44,32,78,'burst-shot','elite','flying']
    ],
    'frostline-canopy': [
      ['canopy-frost','Frost Aphid',3260,438,3060,3660,40,34,54,'aimed-shot','elite'],
      ['canopy-wasp','Frost Wasp',5680,270,5440,6160,36,26,94,'dive-charge','standard','flying']
    ],
    'cloud-nine-citadel': [
      ['citadel-warp-midge','Gravity Midge',2800,300,2520,3380,38,30,70,'blink-strike','elite','blink'],
      ['warp-weaver','Warp Weaver',6420,300,6040,7100,80,62,62,'blink-strike','major-boss','blink']
    ]
  });

  let attackers = [];
  let attackStates = new Map();
  let hostileProjectiles = [];
  let hostileHitboxes = [];
  let telegraphs = new Map();
  let hitsTaken = 0;
  let activeLevelId = '';
  let simTime = 0;

  function decode(def, index) {
    const [id,name,x,y,minX,maxX,width,height,speed,attackPattern,rank,movement] = def;
    return { id,name,x,y,baseY:y,minX,maxX,width,height,speed,attackPattern,rank,movement: movement || 'ground',dir:index % 2 ? -1 : 1,phase:1,defeated:false };
  }

  function resetAttacks() {
    activeLevelId = level?.id || 'sprout-run';
    attackers = (LEVEL_ATTACKERS[activeLevelId] || LEVEL_ATTACKERS['sprout-run']).map(decode);
    attackStates = new Map(attackers.map((enemy, index) => [enemy.id, createEnemyAttackState(enemy, { initialDelay: 0.7 + index * 0.16 })]));
    hostileProjectiles = [];
    hostileHitboxes = [];
    telegraphs = new Map();
    simTime = 0;
  }

  function syncDefeated() {
    const snapshot = window.__SPROUT_COMBAT_BROWSER__?.snapshot?.();
    if (!snapshot) return;
    const byId = new Map(snapshot.enemies.map((enemy) => [enemy.id, enemy]));
    for (const attacker of attackers) attacker.defeated = Boolean(byId.get(attacker.id)?.defeated);
  }

  function moveAttacker(enemy, dt) {
    if (enemy.defeated) return;
    if (enemy.movement === 'blink') {
      const wave = Math.sin(simTime * 1.4 + enemy.x * 0.002);
      enemy.x = Math.max(enemy.minX, Math.min(enemy.maxX - enemy.width, enemy.x + wave * enemy.speed * dt));
    } else {
      enemy.x += enemy.dir * enemy.speed * dt;
      if (enemy.x <= enemy.minX) { enemy.x = enemy.minX; enemy.dir = 1; }
      if (enemy.x + enemy.width >= enemy.maxX) { enemy.x = enemy.maxX - enemy.width; enemy.dir = -1; }
    }
    if (enemy.movement === 'flying') enemy.y = enemy.baseY + Math.sin(simTime * 2.4 + enemy.x * 0.006) * (enemy.rank.includes('boss') ? 40 : 24);
  }

  function knockbackPlayer(next, source, damage) {
    next.power = next.power || {};
    if ((Number(next.power.invulnerableTimer) || 0) > 0) return false;
    const playerCenter = next.x + next.width / 2;
    const sourceCenter = source.x + source.width / 2;
    const dir = playerCenter < sourceCenter ? -1 : 1;
    if ((Number(next.power.shieldCharges) || 0) > 0) {
      next.power.shieldCharges -= 1;
      next.power.invulnerableTimer = Math.max(Number(next.power.invulnerableTimer) || 0, Number(DEFAULTS?.shieldInvulnerability) || 1.05);
      next.state = 'shield-bounce';
      next.vx = dir * 340;
      next.vy = -320;
    } else {
      next.power.invulnerableTimer = HIT_INVULN;
      next.state = 'hurt';
      next.vx = dir * Math.min(460, 320 + Math.max(0, Number(damage) - 1) * 55);
      next.vy = -280;
      next.grounded = false;
      next.enemyAttackHits = (next.enemyAttackHits || 0) + 1;
      hitsTaken += 1;
    }
    return true;
  }

  function stepAttackRuntime(next, dt) {
    const step = Math.max(0, Math.min(Number(dt) || 0, 0.05));
    if ((level?.id || 'sprout-run') !== activeLevelId) resetAttacks();
    simTime += step;
    syncDefeated();

    for (const enemy of attackers) {
      moveAttacker(enemy, step);
      if (enemy.defeated) continue;
      const result = stepEnemyAttack(attackStates.get(enemy.id), enemy, next, step);
      attackStates.set(enemy.id, result.state);
      for (const event of result.events) {
        if (event.type === 'enemy-attack-telegraph') telegraphs.set(enemy.id, { pattern:event.pattern, until:simTime + event.duration });
        if (event.type === 'enemy-attack-released') telegraphs.delete(enemy.id);
      }
      hostileProjectiles.push(...result.projectiles);
      hostileHitboxes.push(...result.hitboxes.map((hitbox) => ({ ...hitbox, remaining: hitbox.duration })));
    }

    hostileProjectiles = hostileProjectiles
      .map((projectile) => advanceEnemyProjectile(projectile, step))
      .filter((projectile) => projectile.lifetime > 0 && projectile.x > -120 && projectile.x < (level?.worldWidth || 8000) + 120);

    for (const projectile of hostileProjectiles) {
      if (projectile.hit || !overlapsRect(projectile, next)) continue;
      if (knockbackPlayer(next, projectile, projectile.damage)) projectile.hit = true;
    }
    hostileProjectiles = hostileProjectiles.filter((projectile) => !projectile.hit);

    for (const hitbox of hostileHitboxes) {
      hitbox.remaining = Math.max(0, hitbox.remaining - step);
      if (hitbox.type === 'ground-wave') hitbox.x += (Number(hitbox.speed) || 0) * step;
      if (!hitbox.hit && overlapsRect(hitbox, next) && knockbackPlayer(next, hitbox, hitbox.damage)) hitbox.hit = true;
    }
    hostileHitboxes = hostileHitboxes.filter((hitbox) => hitbox.remaining > 0 && !hitbox.hit);
  }

  function drawAttacks() {
    if (typeof ctx === 'undefined' || typeof cameraX === 'undefined') return;
    ctx.save();
    for (const enemy of attackers) {
      const telegraph = telegraphs.get(enemy.id);
      if (!telegraph || telegraph.until <= simTime || enemy.defeated) continue;
      const x = enemy.x - cameraX + enemy.width / 2;
      const y = enemy.y + enemy.height / 2;
      ctx.strokeStyle = 'rgba(255,202,97,.92)';
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.arc(x, y, Math.max(enemy.width, enemy.height) * (0.7 + Math.abs(Math.sin(simTime * 15)) * 0.18), 0, Math.PI * 2);
      ctx.stroke();
    }
    for (const projectile of hostileProjectiles) {
      ctx.fillStyle = '#ffb45f';
      ctx.shadowBlur = 10;
      ctx.shadowColor = '#ff7f4d';
      ctx.beginPath();
      ctx.arc(projectile.x - cameraX + projectile.width / 2, projectile.y + projectile.height / 2, 6, 0, Math.PI * 2);
      ctx.fill();
    }
    for (const hitbox of hostileHitboxes) {
      ctx.globalAlpha = 0.36;
      ctx.fillStyle = hitbox.type === 'blink-strike' ? '#cf9cff' : '#ff8b62';
      ctx.fillRect(hitbox.x - cameraX, hitbox.y, hitbox.width, hitbox.height);
      ctx.globalAlpha = 1;
    }
    ctx.restore();
  }

  function installHooks() {
    if (typeof stepPlayer !== 'function' || typeof render !== 'function' || typeof reset !== 'function') return false;
    const baseStep = stepPlayer;
    stepPlayer = function seedManEnemyAttackStep(inputPlayer, inputState, levelData, dt, config) {
      const next = baseStep(inputPlayer, inputState, levelData, dt, config);
      if (!paused && !next.finished) stepAttackRuntime(next, dt);
      return next;
    };
    const baseRender = render;
    render = function seedManEnemyAttackRender() { baseRender(); drawAttacks(); };
    const baseReset = reset;
    reset = function seedManEnemyAttackReset() { baseReset(); resetAttacks(); };
    return true;
  }

  resetAttacks();
  const installed = installHooks();
  window.__SPROUT_ENEMY_ATTACKS_BROWSER__ = Object.freeze({
    version: VERSION,
    installed,
    snapshot: () => ({
      version: VERSION,
      installed,
      levelId: activeLevelId,
      hitsTaken,
      projectileCount: hostileProjectiles.length,
      hitboxCount: hostileHitboxes.length,
      telegraphCount: [...telegraphs.values()].filter((item) => item.until > simTime).length,
      attackers: attackers.map(({id,name,attackPattern,rank,defeated}) => ({id,name,attackPattern,rank,defeated}))
    })
  });
})().catch((error) => {
  console.error('Seed Man enemy attack browser adapter failed to initialize.', error);
});
