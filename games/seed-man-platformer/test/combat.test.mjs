import assert from 'node:assert/strict';
import { createProgressionState, collectWeapon, acquirePhenotype } from '../src/systems/player-progression.mjs';
import {
  createCombatState,
  createEnemy,
  fireEquippedWeapon,
  fireActivePhenotype,
  stepCombat,
  combatSnapshot
} from '../src/systems/combat.mjs';
import {
  ENEMY_ARCHETYPES,
  LEVEL_01_COMBAT_ENCOUNTERS,
  createEnemyFromArchetype,
  instantiateEncounterSet
} from '../src/systems/enemy-archetypes.mjs';

function advance(state, seconds, dt = 1 / 60) {
  let next = state;
  for (let elapsed = 0; elapsed < seconds; elapsed += dt) next = stepCombat(next, dt);
  return next;
}

assert.ok(Object.keys(ENEMY_ARCHETYPES).length >= 7, 'Combat roster should contain multiple base and elite enemy archetypes.');
const authoredEncounters = instantiateEncounterSet();
assert.equal(authoredEncounters.length, LEVEL_01_COMBAT_ENCOUNTERS.length);
assert.ok(authoredEncounters.some((enemy) => enemy.phenotypeReward === 'static-haze'), 'Level 1 should contain an elite phenotype carrier.');
const frostElite = createEnemyFromArchetype('elite-frost-aphid', { id: 'test-frost', x: 20, y: 10 });
assert.equal(frostElite.phenotypeReward, 'frost-resin');
assert.equal(frostElite.drops.alleles, 1);

let progression = createProgressionState();
progression = collectWeapon(progression, 'seed-slinger');
let state = createCombatState({
  progression,
  enemies: [
    createEnemy({
      id: 'mite-elite',
      kind: 'mite',
      x: 120,
      y: 0,
      width: 28,
      height: 28,
      health: 2,
      phenotypeReward: 'static-haze',
      drops: { trichomes: 3, 'genetic-fragments': 1 }
    })
  ]
});

state = fireEquippedWeapon(state, { x: 0, y: 14, facing: 1 });
assert.equal(state.projectiles.length, 1, 'Seed Slinger should create one projectile.');
assert.ok(state.cooldowns['seed-slinger'] > 0, 'Weapon fire should start a cooldown.');
const blockedShot = fireEquippedWeapon(state, { x: 0, y: 14, facing: 1 });
assert.equal(blockedShot.projectiles.length, 1, 'Weapon cooldown should prevent duplicate immediate fire.');

state = advance(state, 0.3);
assert.equal(state.enemies[0].health, 1, 'First Seed Slinger hit should remove one health.');
state = advance(state, 0.2);
state = fireEquippedWeapon(state, { x: 0, y: 14, facing: 1 });
state = advance(state, 0.3);
assert.equal(state.enemies[0].defeated, true, 'Second Seed Slinger hit should defeat a two-health enemy.');
assert.equal(state.progression.activePhenotype, 'static-haze', 'Defeating an elite should acquire its phenotype reward.');
assert.ok(state.progression.discoveredPhenotypes.includes('static-haze'));
assert.equal(state.progression.resources.trichomes, 3);
assert.equal(state.progression.resources['genetic-fragments'], 1);

progression = acquirePhenotype(progression, 'frost-resin');
state = createCombatState({
  progression,
  enemies: [createEnemy({ id: 'aphid', x: 80, y: 0, health: 3 })]
});
state = fireActivePhenotype(state, { x: 0, y: 14, facing: 1 });
state = advance(state, 0.3);
assert.ok(state.enemies[0].statuses.freeze > 0, 'Frost Resin should freeze a hit enemy.');
assert.equal(state.enemies[0].health, 2);

progression = acquirePhenotype(progression, 'solar-flare');
state = createCombatState({
  progression,
  enemies: [createEnemy({ id: 'burn-target', x: 80, y: 0, health: 5 })]
});
state = fireActivePhenotype(state, { x: 0, y: 14, facing: 1 });
state = advance(state, 1.5);
assert.ok(state.enemies[0].health <= 2, 'Solar Flare should apply direct plus burn damage over time.');

progression = acquirePhenotype(progression, 'static-haze');
state = createCombatState({
  progression,
  enemies: [
    createEnemy({ id: 'chain-a', x: 80, y: 0, health: 2 }),
    createEnemy({ id: 'chain-b', x: 150, y: 0, health: 2 })
  ]
});
state = fireActivePhenotype(state, { x: 0, y: 14, facing: 1 });
state = advance(state, 0.25);
assert.equal(state.enemies[0].health, 1, 'Static Haze should damage the direct target.');
assert.equal(state.enemies[1].health, 1, 'Static Haze should chain to a nearby second target.');

progression = createProgressionState();
progression = collectWeapon(progression, 'pollen-blaster');
state = createCombatState({ progression });
state = fireEquippedWeapon(state, { x: 0, y: 0, facing: 1 });
assert.equal(state.projectiles.length, 3, 'Pollen Blaster should emit its configured three-shot spread.');

const snapshot = combatSnapshot(state);
assert.equal(snapshot.equippedWeapon, 'pollen-blaster');
assert.equal(snapshot.enemiesAlive, 0);
assert.equal(snapshot.projectiles, 3);

console.log('Seed Man combat, enemy archetype, reward, and phenotype acquisition tests passed');
