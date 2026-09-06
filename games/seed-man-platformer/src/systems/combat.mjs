import { createWeaponShot, getWeapon } from './weapons.mjs';
import { getPhenotype, phenotypeProjectile } from './phenotypes.mjs';
import { acquirePhenotype, collectResource, normalizeProgressionState } from './player-progression.mjs';

export const COMBAT_DEFAULTS = Object.freeze({
  projectileLifetime: 2.4,
  enemyHitFlash: 0.12,
  defeatDelay: 0.22,
  freezeDuration: 1.4,
  burnDuration: 1.8,
  burnTickDamage: 1,
  burnTickInterval: 0.6,
  pushVelocity: 150,
  liftVelocity: -170,
  chainRadius: 130
});

export function createEnemy(definition = {}) {
  const maxHealth = Math.max(1, Math.floor(Number(definition.health) || 1));
  return {
    id: definition.id || 'enemy',
    kind: definition.kind || 'pest',
    x: Number(definition.x) || 0,
    y: Number(definition.y) || 0,
    width: Math.max(1, Number(definition.width) || 28),
    height: Math.max(1, Number(definition.height) || 24),
    vx: Number(definition.vx) || 0,
    vy: Number(definition.vy) || 0,
    maxHealth,
    health: maxHealth,
    phenotypeReward: definition.phenotypeReward || null,
    drops: { ...(definition.drops || {}) },
    defeated: false,
    defeatTimer: 0,
    hitFlash: 0,
    statuses: {}
  };
}

export function createCombatState({ progression = null, enemies = [] } = {}) {
  return {
    progression: normalizeProgressionState(progression),
    enemies: enemies.map(createEnemy),
    projectiles: [],
    cooldowns: {},
    nextProjectileId: 1,
    events: []
  };
}

function cloneCombatState(input) {
  return {
    progression: normalizeProgressionState(input.progression),
    enemies: input.enemies.map((enemy) => ({ ...enemy, statuses: { ...(enemy.statuses || {}) }, drops: { ...(enemy.drops || {}) } })),
    projectiles: input.projectiles.map((projectile) => ({ ...projectile, hitEnemyIds: [...(projectile.hitEnemyIds || [])] })),
    cooldowns: { ...(input.cooldowns || {}) },
    nextProjectileId: Number.isInteger(input.nextProjectileId) ? input.nextProjectileId : 1,
    events: []
  };
}

function overlaps(a, b) {
  return a.x < b.x + b.width && a.x + a.width > b.x && a.y < b.y + b.height && a.y + a.height > b.y;
}

function enemyCenter(enemy) {
  return { x: enemy.x + enemy.width / 2, y: enemy.y + enemy.height / 2 };
}

function distanceBetweenEnemies(a, b) {
  const ac = enemyCenter(a);
  const bc = enemyCenter(b);
  return Math.hypot(ac.x - bc.x, ac.y - bc.y);
}

function projectileRect(projectile) {
  const size = projectile.radius ? projectile.radius * 2 : 10;
  return {
    x: projectile.x - size / 2,
    y: projectile.y - size / 2,
    width: size,
    height: size
  };
}

function applyDamage(enemy, amount, state, source) {
  if (enemy.defeated) return false;
  const damage = Math.max(0, Math.floor(Number(amount) || 0));
  if (!damage) return false;
  enemy.health = Math.max(0, enemy.health - damage);
  enemy.hitFlash = COMBAT_DEFAULTS.enemyHitFlash;
  state.events.push({ type: 'enemy-hit', enemyId: enemy.id, damage, source });
  if (enemy.health === 0) {
    enemy.defeated = true;
    enemy.defeatTimer = COMBAT_DEFAULTS.defeatDelay;
    state.events.push({ type: 'enemy-defeated', enemyId: enemy.id, source });
    if (enemy.phenotypeReward && getPhenotype(enemy.phenotypeReward)) {
      state.progression = acquirePhenotype(state.progression, enemy.phenotypeReward);
      state.events.push({ type: 'phenotype-acquired', enemyId: enemy.id, phenotypeId: enemy.phenotypeReward });
    }
    for (const [resource, quantity] of Object.entries(enemy.drops || {})) {
      try {
        state.progression = collectResource(state.progression, resource, quantity);
        state.events.push({ type: 'resource-collected', enemyId: enemy.id, resource, amount: Math.max(0, Math.floor(Number(quantity) || 0)) });
      } catch {
        // Unknown drop keys are ignored so content data cannot crash combat.
      }
    }
  }
  return true;
}

function applyProjectileEffect(enemy, projectile, state) {
  const effect = projectile.effect || null;
  if (!effect) return;
  if (effect === 'freeze') {
    enemy.statuses.freeze = Math.max(enemy.statuses.freeze || 0, COMBAT_DEFAULTS.freezeDuration);
  } else if (effect === 'burn') {
    enemy.statuses.burn = {
      remaining: Math.max(enemy.statuses.burn?.remaining || 0, COMBAT_DEFAULTS.burnDuration),
      tick: COMBAT_DEFAULTS.burnTickInterval
    };
  } else if (effect === 'push' || effect === 'gust') {
    const direction = projectile.vx < 0 ? -1 : 1;
    enemy.vx += COMBAT_DEFAULTS.pushVelocity * direction;
  } else if (effect === 'lift') {
    enemy.vy = Math.min(enemy.vy, COMBAT_DEFAULTS.liftVelocity);
  } else if (effect === 'chain') {
    const candidates = state.enemies
      .filter((other) => other.id !== enemy.id && !other.defeated && !(projectile.hitEnemyIds || []).includes(other.id))
      .sort((a, b) => distanceBetweenEnemies(enemy, a) - distanceBetweenEnemies(enemy, b));
    const chained = candidates.find((other) => distanceBetweenEnemies(enemy, other) <= COMBAT_DEFAULTS.chainRadius);
    if (chained) {
      applyDamage(chained, projectile.damage, state, { projectileId: projectile.id, effect: 'chain' });
      projectile.hitEnemyIds.push(chained.id);
      state.events.push({ type: 'chain-hit', fromEnemyId: enemy.id, enemyId: chained.id, projectileId: projectile.id });
    }
  }
}

function spawnProjectile(state, shot, origin, extra = {}) {
  const id = `projectile-${state.nextProjectileId++}`;
  const projectile = {
    id,
    x: Number(origin.x) || 0,
    y: Number(origin.y) || 0,
    vx: Number(shot.vx) || 0,
    vy: Number(extra.vy) || 0,
    width: 10,
    height: 10,
    radius: Number(extra.radius) || 0,
    damage: Math.max(0, Number(shot.damage) || 0),
    effect: shot.effect || extra.effect || null,
    pierceRemaining: Math.max(0, Number(shot.pierce) || 0),
    lifetime: COMBAT_DEFAULTS.projectileLifetime,
    hitEnemyIds: [],
    source: extra.source || 'weapon',
    weaponId: shot.weaponId || null,
    phenotypeId: shot.phenotypeId || shot.phenotype || null
  };
  state.projectiles.push(projectile);
  state.events.push({ type: 'projectile-fired', projectileId: id, weaponId: projectile.weaponId, phenotypeId: projectile.phenotypeId });
  return projectile;
}

export function fireEquippedWeapon(inputState, { x = 0, y = 0, facing = 1 } = {}) {
  const state = cloneCombatState(inputState);
  const weaponId = state.progression.equippedWeapon;
  const weapon = getWeapon(weaponId);
  if (!weapon) return state;
  const cooldown = Math.max(0, Number(state.cooldowns[weaponId]) || 0);
  if (cooldown > 0) return state;

  const baseShot = createWeaponShot(weaponId, { x, y, facing, phenotype: state.progression.activePhenotype });
  const pelletCount = Math.max(1, baseShot.pellets || 1);
  for (let index = 0; index < pelletCount; index += 1) {
    const spread = pelletCount === 1 ? 0 : (index - (pelletCount - 1) / 2) * 75;
    spawnProjectile(state, baseShot, { x, y }, { vy: spread, source: 'weapon' });
  }
  state.cooldowns[weaponId] = weapon.cooldown;
  return state;
}

export function fireActivePhenotype(inputState, { x = 0, y = 0, facing = 1 } = {}) {
  const state = cloneCombatState(inputState);
  const phenotypeId = state.progression.activePhenotype;
  const shot = phenotypeProjectile(phenotypeId, facing);
  if (!shot) return state;
  const cooldownKey = `phenotype:${phenotypeId}`;
  if ((state.cooldowns[cooldownKey] || 0) > 0) return state;
  spawnProjectile(state, shot, { x, y }, { source: 'phenotype' });
  state.cooldowns[cooldownKey] = 0.55;
  return state;
}

function tickEnemyStatuses(enemy, dt, state) {
  enemy.hitFlash = Math.max(0, (enemy.hitFlash || 0) - dt);
  if (enemy.defeated) {
    enemy.defeatTimer = Math.max(0, (enemy.defeatTimer || 0) - dt);
    return;
  }
  if (enemy.statuses.freeze) enemy.statuses.freeze = Math.max(0, enemy.statuses.freeze - dt);
  const burn = enemy.statuses.burn;
  if (burn && burn.remaining > 0) {
    burn.remaining = Math.max(0, burn.remaining - dt);
    burn.tick -= dt;
    while (burn.tick <= 0 && burn.remaining > 0 && !enemy.defeated) {
      applyDamage(enemy, COMBAT_DEFAULTS.burnTickDamage, state, { effect: 'burn' });
      burn.tick += COMBAT_DEFAULTS.burnTickInterval;
    }
    if (burn.remaining <= 0) delete enemy.statuses.burn;
  }
  const motionScale = enemy.statuses.freeze > 0 ? 0.25 : 1;
  enemy.x += enemy.vx * motionScale * dt;
  enemy.y += enemy.vy * motionScale * dt;
  enemy.vx *= Math.pow(0.12, dt);
  enemy.vy *= Math.pow(0.12, dt);
}

export function stepCombat(inputState, dt) {
  const state = cloneCombatState(inputState);
  const step = Math.min(Math.max(Number(dt) || 0, 0), 0.05);
  for (const key of Object.keys(state.cooldowns)) state.cooldowns[key] = Math.max(0, state.cooldowns[key] - step);
  for (const enemy of state.enemies) tickEnemyStatuses(enemy, step, state);

  for (const projectile of state.projectiles) {
    projectile.x += projectile.vx * step;
    projectile.y += projectile.vy * step;
    projectile.lifetime -= step;
    if (projectile.lifetime <= 0) continue;
    for (const enemy of state.enemies) {
      if (enemy.defeated || projectile.hitEnemyIds.includes(enemy.id)) continue;
      if (!overlaps(projectileRect(projectile), enemy)) continue;
      projectile.hitEnemyIds.push(enemy.id);
      applyDamage(enemy, projectile.damage, state, { projectileId: projectile.id, weaponId: projectile.weaponId, phenotypeId: projectile.phenotypeId });
      applyProjectileEffect(enemy, projectile, state);
      if (projectile.pierceRemaining > 0) projectile.pierceRemaining -= 1;
      else {
        projectile.lifetime = 0;
        break;
      }
    }
  }

  state.projectiles = state.projectiles.filter((projectile) => projectile.lifetime > 0);
  return state;
}

export function combatSnapshot(state) {
  return {
    enemiesAlive: state.enemies.filter((enemy) => !enemy.defeated).length,
    projectiles: state.projectiles.length,
    equippedWeapon: state.progression.equippedWeapon,
    activePhenotype: state.progression.activePhenotype,
    resources: { ...state.progression.resources }
  };
}
