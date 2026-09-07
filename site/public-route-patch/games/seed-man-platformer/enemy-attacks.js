export const ENEMY_ATTACK_DEFAULTS = Object.freeze({
  standardCooldown: 2.4,
  eliteCooldown: 2,
  minorBossCooldown: 1.7,
  majorBossCooldown: 1.45,
  telegraphSeconds: 0.45,
  projectileLifetime: 3.2,
  projectileSpeed: 260,
  projectileDamage: 1,
  contactInvulnerability: 0.75
});

export const ATTACK_PATTERNS = Object.freeze({
  contact: Object.freeze({ type: 'contact', telegraphSeconds: 0, cooldown: 0 }),
  'aimed-shot': Object.freeze({ type: 'projectile', telegraphSeconds: 0.38, cooldown: 2.2, projectileSpeed: 280, damage: 1, count: 1 }),
  'burst-shot': Object.freeze({ type: 'projectile', telegraphSeconds: 0.55, cooldown: 2.6, projectileSpeed: 250, damage: 1, count: 3, spreadRadians: 0.22 }),
  'radial-burst': Object.freeze({ type: 'radial', telegraphSeconds: 0.8, cooldown: 2.9, projectileSpeed: 235, damage: 1, count: 8 }),
  'dive-charge': Object.freeze({ type: 'charge', telegraphSeconds: 0.5, cooldown: 2.4, damage: 2, chargeSpeed: 330, duration: 0.6 }),
  'ground-wave': Object.freeze({ type: 'wave', telegraphSeconds: 0.72, cooldown: 2.8, damage: 2, speed: 300, width: 120, height: 34, duration: 0.85 }),
  'blink-strike': Object.freeze({ type: 'blink', telegraphSeconds: 0.5, cooldown: 2.15, damage: 2, radius: 74, duration: 0.22 })
});

const RANK_COOLDOWNS = Object.freeze({
  standard: ENEMY_ATTACK_DEFAULTS.standardCooldown,
  elite: ENEMY_ATTACK_DEFAULTS.eliteCooldown,
  'minor-boss': ENEMY_ATTACK_DEFAULTS.minorBossCooldown,
  'major-boss': ENEMY_ATTACK_DEFAULTS.majorBossCooldown
});

function finite(value, fallback) {
  const number = Number(value);
  return Number.isFinite(number) ? number : fallback;
}

function center(rect = {}) {
  return {
    x: finite(rect.x, 0) + Math.max(0, finite(rect.width, 0)) / 2,
    y: finite(rect.y, 0) + Math.max(0, finite(rect.height, 0)) / 2
  };
}

function unitVector(from, to) {
  const dx = to.x - from.x;
  const dy = to.y - from.y;
  const magnitude = Math.hypot(dx, dy) || 1;
  return { x: dx / magnitude, y: dy / magnitude };
}

function rotate(vector, radians) {
  const cos = Math.cos(radians);
  const sin = Math.sin(radians);
  return { x: vector.x * cos - vector.y * sin, y: vector.x * sin + vector.y * cos };
}

function phaseScale(enemy) {
  const phase = Math.max(1, Math.floor(finite(enemy?.phase, 1)));
  return Math.max(0.52, 1 - (phase - 1) * 0.12);
}

export function attackProfileForEnemy(enemy = {}) {
  const requested = enemy.attackPattern || (enemy.rank === 'major-boss' ? 'burst-shot' : enemy.rank === 'minor-boss' ? 'dive-charge' : 'contact');
  const template = ATTACK_PATTERNS[requested] || ATTACK_PATTERNS.contact;
  const rankCooldown = RANK_COOLDOWNS[enemy.rank] ?? ENEMY_ATTACK_DEFAULTS.standardCooldown;
  return {
    id: requested in ATTACK_PATTERNS ? requested : 'contact',
    ...template,
    cooldown: Math.max(0, finite(enemy.attackCooldown, template.cooldown || rankCooldown)),
    telegraphSeconds: Math.max(0, finite(enemy.attackTelegraphSeconds, enemy.telegraphSeconds || template.telegraphSeconds || ENEMY_ATTACK_DEFAULTS.telegraphSeconds)),
    damage: Math.max(0, finite(enemy.attackDamage, template.damage || enemy.contactDamage || ENEMY_ATTACK_DEFAULTS.projectileDamage)),
    projectileSpeed: Math.max(0, finite(enemy.projectileSpeed, template.projectileSpeed || ENEMY_ATTACK_DEFAULTS.projectileSpeed))
  };
}

export function createEnemyAttackState(enemy = {}, { initialDelay = null } = {}) {
  const profile = attackProfileForEnemy(enemy);
  const delay = initialDelay == null ? Math.max(0.1, profile.cooldown * 0.55) : Math.max(0, finite(initialDelay, 0));
  return {
    pattern: profile.id,
    cooldownRemaining: delay,
    telegraphRemaining: 0,
    pending: false,
    sequence: 0
  };
}

function projectile(id, enemy, x, y, vector, speed, damage, lifetime = ENEMY_ATTACK_DEFAULTS.projectileLifetime) {
  return {
    id,
    owner: 'enemy',
    enemyId: enemy.id,
    x,
    y,
    vx: vector.x * speed,
    vy: vector.y * speed,
    width: 10,
    height: 10,
    damage,
    lifetime,
    pattern: enemy.attackPattern || null
  };
}

function releaseProjectiles(enemy, target, profile, sequence) {
  const origin = center(enemy);
  const aim = unitVector(origin, center(target));
  const count = Math.max(1, Math.floor(finite(profile.count, 1)));
  const projectiles = [];

  if (profile.type === 'radial') {
    for (let index = 0; index < count; index += 1) {
      const angle = (Math.PI * 2 * index) / count;
      const vector = { x: Math.cos(angle), y: Math.sin(angle) };
      projectiles.push(projectile(`${enemy.id}-attack-${sequence}-${index}`, enemy, origin.x, origin.y, vector, profile.projectileSpeed, profile.damage));
    }
    return projectiles;
  }

  const spread = Math.max(0, finite(profile.spreadRadians, 0));
  for (let index = 0; index < count; index += 1) {
    const offset = count === 1 ? 0 : (index - (count - 1) / 2) * spread;
    projectiles.push(projectile(`${enemy.id}-attack-${sequence}-${index}`, enemy, origin.x, origin.y, rotate(aim, offset), profile.projectileSpeed, profile.damage));
  }
  return projectiles;
}

function releaseHitbox(enemy, target, profile, sequence) {
  const origin = center(enemy);
  const targetCenter = center(target);
  const direction = targetCenter.x < origin.x ? -1 : 1;

  if (profile.type === 'charge') {
    return {
      id: `${enemy.id}-charge-${sequence}`,
      enemyId: enemy.id,
      type: 'charge',
      x: direction > 0 ? enemy.x : enemy.x - profile.chargeSpeed * profile.duration,
      y: enemy.y,
      width: enemy.width + profile.chargeSpeed * profile.duration,
      height: enemy.height,
      damage: profile.damage,
      duration: profile.duration,
      direction
    };
  }

  if (profile.type === 'wave') {
    return {
      id: `${enemy.id}-wave-${sequence}`,
      enemyId: enemy.id,
      type: 'ground-wave',
      x: direction > 0 ? enemy.x + enemy.width : enemy.x - profile.width,
      y: enemy.y + enemy.height - profile.height,
      width: profile.width,
      height: profile.height,
      damage: profile.damage,
      speed: profile.speed * direction,
      duration: profile.duration,
      direction
    };
  }

  if (profile.type === 'blink') {
    return {
      id: `${enemy.id}-blink-${sequence}`,
      enemyId: enemy.id,
      type: 'blink-strike',
      x: targetCenter.x - profile.radius,
      y: targetCenter.y - profile.radius,
      width: profile.radius * 2,
      height: profile.radius * 2,
      damage: profile.damage,
      duration: profile.duration,
      direction
    };
  }

  return null;
}

export function stepEnemyAttack(inputState, enemy, target, dt) {
  const profile = attackProfileForEnemy(enemy);
  const state = { ...createEnemyAttackState(enemy), ...(inputState || {}) };
  const step = Math.max(0, Math.min(finite(dt, 0), 0.05));
  const events = [];
  const projectiles = [];
  const hitboxes = [];

  if (enemy?.defeated || profile.type === 'contact') return { state, events, projectiles, hitboxes };

  if (!state.pending) {
    state.cooldownRemaining = Math.max(0, finite(state.cooldownRemaining, 0) - step);
    if (state.cooldownRemaining <= 0) {
      state.pending = true;
      state.telegraphRemaining = profile.telegraphSeconds;
      events.push({ type: 'enemy-attack-telegraph', enemyId: enemy.id, pattern: profile.id, duration: profile.telegraphSeconds, phase: Math.max(1, enemy.phase || 1) });
      if (profile.telegraphSeconds <= 0) state.telegraphRemaining = 0;
    }
  } else {
    state.telegraphRemaining = Math.max(0, finite(state.telegraphRemaining, 0) - step);
  }

  if (state.pending && state.telegraphRemaining <= 0) {
    state.pending = false;
    state.sequence = Math.max(0, Math.floor(finite(state.sequence, 0))) + 1;
    state.cooldownRemaining = Math.max(0.1, profile.cooldown * phaseScale(enemy));
    events.push({ type: 'enemy-attack-released', enemyId: enemy.id, pattern: profile.id, phase: Math.max(1, enemy.phase || 1), sequence: state.sequence });

    if (profile.type === 'projectile' || profile.type === 'radial') {
      projectiles.push(...releaseProjectiles(enemy, target, profile, state.sequence));
    } else {
      const hitbox = releaseHitbox(enemy, target, profile, state.sequence);
      if (hitbox) hitboxes.push(hitbox);
    }
  }

  return { state, events, projectiles, hitboxes };
}

export function overlapsRect(a, b) {
  return Boolean(a && b && a.x < b.x + b.width && a.x + a.width > b.x && a.y < b.y + b.height && a.y + a.height > b.y);
}

export function resolveEnemyContact(enemy, target, { invulnerable = false } = {}) {
  if (!enemy || enemy.defeated || invulnerable || !overlapsRect(enemy, target)) return null;
  const damage = Math.max(0, finite(enemy.contactDamage, 1));
  if (damage <= 0) return null;
  return {
    type: 'player-hit',
    source: 'enemy-contact',
    enemyId: enemy.id,
    damage,
    invulnerabilitySeconds: ENEMY_ATTACK_DEFAULTS.contactInvulnerability
  };
}

export function advanceEnemyProjectile(inputProjectile, dt) {
  const projectile = { ...inputProjectile };
  const step = Math.max(0, Math.min(finite(dt, 0), 0.05));
  projectile.x += finite(projectile.vx, 0) * step;
  projectile.y += finite(projectile.vy, 0) * step;
  projectile.lifetime = Math.max(0, finite(projectile.lifetime, 0) - step);
  return projectile;
}
