import assert from 'node:assert/strict';
import {
  ATTACK_PATTERNS,
  attackProfileForEnemy,
  createEnemyAttackState,
  stepEnemyAttack,
  resolveEnemyContact,
  advanceEnemyProjectile,
  overlapsRect
} from '../src/systems/enemy-attacks.mjs';

function advanceAttack(enemy, target, seconds, state = createEnemyAttackState(enemy), dt = 1 / 60) {
  let current = state;
  const events = [];
  const projectiles = [];
  const hitboxes = [];
  for (let elapsed = 0; elapsed < seconds; elapsed += dt) {
    const result = stepEnemyAttack(current, enemy, target, dt);
    current = result.state;
    events.push(...result.events);
    projectiles.push(...result.projectiles);
    hitboxes.push(...result.hitboxes);
  }
  return { state: current, events, projectiles, hitboxes };
}

assert.deepStrictEqual(
  Object.keys(ATTACK_PATTERNS).sort(),
  ['aimed-shot', 'blink-strike', 'burst-shot', 'contact', 'dive-charge', 'ground-wave', 'radial-burst'].sort()
);

const target = { x: 300, y: 120, width: 34, height: 46 };
const shooter = {
  id: 'gnat-shooter', rank: 'elite', attackPattern: 'aimed-shot', x: 80, y: 100, width: 40, height: 30,
  attackCooldown: 0.5, attackTelegraphSeconds: 0.2, attackDamage: 2, projectileSpeed: 300
};
let result = advanceAttack(shooter, target, 1.1, createEnemyAttackState(shooter, { initialDelay: 0 }));
assert.ok(result.events.some((event) => event.type === 'enemy-attack-telegraph'));
assert.ok(result.events.some((event) => event.type === 'enemy-attack-released'));
assert.ok(result.projectiles.length >= 1, 'Aimed-shot should release an enemy projectile.');
assert.equal(result.projectiles[0].owner, 'enemy');
assert.equal(result.projectiles[0].damage, 2);
assert.ok(result.projectiles[0].vx > 0, 'Projectile should aim toward a target to the right.');

const burstBoss = {
  id: 'queen', rank: 'major-boss', phase: 3, attackPattern: 'burst-shot', x: 100, y: 100, width: 78, height: 66,
  attackCooldown: 1.8, attackTelegraphSeconds: 0.1
};
result = advanceAttack(burstBoss, target, 0.5, createEnemyAttackState(burstBoss, { initialDelay: 0 }));
assert.equal(result.projectiles.length, 3, 'Burst boss attack should emit three projectiles.');
assert.ok(result.state.cooldownRemaining < 1.8, 'Later boss phases should shorten the next attack cooldown.');

const radialBoss = {
  id: 'seraph', rank: 'major-boss', phase: 2, attackPattern: 'radial-burst', x: 220, y: 80, width: 82, height: 60,
  attackTelegraphSeconds: 0.05
};
result = advanceAttack(radialBoss, target, 0.35, createEnemyAttackState(radialBoss, { initialDelay: 0 }));
assert.equal(result.projectiles.length, 8, 'Radial boss attack should cover eight directions.');
assert.ok(result.projectiles.some((projectile) => projectile.vx > 0));
assert.ok(result.projectiles.some((projectile) => projectile.vx < 0));
assert.ok(result.projectiles.some((projectile) => projectile.vy > 0));
assert.ok(result.projectiles.some((projectile) => projectile.vy < 0));

for (const pattern of ['dive-charge', 'ground-wave', 'blink-strike']) {
  const enemy = {
    id: pattern,
    rank: pattern === 'blink-strike' ? 'major-boss' : 'minor-boss',
    phase: 1,
    attackPattern: pattern,
    x: 100,
    y: 180,
    width: 60,
    height: 50,
    attackTelegraphSeconds: 0.05
  };
  const attack = advanceAttack(enemy, target, 0.4, createEnemyAttackState(enemy, { initialDelay: 0 }));
  assert.equal(attack.hitboxes.length, 1, `${pattern} should release one deterministic attack hitbox.`);
  assert.equal(attack.hitboxes[0].enemyId, pattern);
  assert.ok(attack.hitboxes[0].damage >= 1);
}

const contactEnemy = { id: 'aphid', x: 10, y: 10, width: 30, height: 30, contactDamage: 2 };
const overlappingPlayer = { x: 25, y: 20, width: 34, height: 46 };
assert.equal(overlapsRect(contactEnemy, overlappingPlayer), true);
const contactHit = resolveEnemyContact(contactEnemy, overlappingPlayer);
assert.equal(contactHit.type, 'player-hit');
assert.equal(contactHit.damage, 2);
assert.equal(resolveEnemyContact(contactEnemy, overlappingPlayer, { invulnerable: true }), null);
assert.equal(resolveEnemyContact(contactEnemy, { x: 500, y: 500, width: 34, height: 46 }), null);

const moved = advanceEnemyProjectile({ x: 0, y: 0, vx: 120, vy: -60, lifetime: 1 }, 0.25);
// Integration clamps large frame gaps to 50 ms, matching the rest of Seed Man simulation.
assert.equal(moved.x, 6);
assert.equal(moved.y, -3);
assert.ok(Math.abs(moved.lifetime - 0.95) < 1e-9);

assert.equal(attackProfileForEnemy({ rank: 'major-boss' }).id, 'burst-shot');
assert.equal(attackProfileForEnemy({ rank: 'minor-boss' }).id, 'dive-charge');
assert.equal(attackProfileForEnemy({ rank: 'standard' }).id, 'contact');

console.log('Seed Man enemy attack telegraphs, releases, projectiles, hitboxes, contact damage, and boss phase scaling passed');
