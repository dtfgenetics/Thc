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
import { PHENOTYPES, PHENOTYPE_ABILITIES, getPhenotypeAbility } from '../src/systems/phenotypes.mjs';
import {
  ENEMY_ARCHETYPES,
  LEVEL_01_COMBAT_ENCOUNTERS,
  CAMPAIGN_PHENOTYPE_CARRIERS,
  BOSS_ARCHETYPES,
  createEnemyFromArchetype,
  instantiateEncounterSet
} from '../src/systems/enemy-archetypes.mjs';

function advance(state, seconds, dt = 1 / 60) {
  let next = state;
  for (let elapsed = 0; elapsed < seconds; elapsed += dt) next = stepCombat(next, dt);
  return next;
}

assert.ok(Object.keys(ENEMY_ARCHETYPES).length >= 20, 'Combat roster should contain standard, elite, flying, and boss archetypes.');
const authoredEncounters = instantiateEncounterSet();
assert.equal(authoredEncounters.length, LEVEL_01_COMBAT_ENCOUNTERS.length);
assert.ok(authoredEncounters.some((enemy) => enemy.phenotypeReward === 'static-haze'), 'Level 1 should contain an elite phenotype carrier.');
assert.ok(authoredEncounters.some((enemy) => enemy.movement === 'flying'), 'Level 1 should introduce a flying enemy.');
const frostElite = createEnemyFromArchetype('elite-frost-aphid', { id: 'test-frost', x: 20, y: 10 });
assert.equal(frostElite.phenotypeReward, 'frost-resin');
assert.equal(frostElite.drops.alleles, 1);

assert.equal(Object.keys(PHENOTYPES).length, 10, 'Seed Man should retain ten canonical phenotype families.');
assert.equal(Object.keys(PHENOTYPE_ABILITIES).length, 10, 'Every canonical phenotype needs an authored action contract.');
assert.equal(CAMPAIGN_PHENOTYPE_CARRIERS.length, 10, 'Every phenotype should have an elite carrier archetype.');
for (const archetypeId of CAMPAIGN_PHENOTYPE_CARRIERS) {
  const archetype = ENEMY_ARCHETYPES[archetypeId];
  assert.ok(archetype, `Missing phenotype carrier ${archetypeId}`);
  assert.equal(archetype.rank, 'elite');
  assert.ok(PHENOTYPES[archetype.phenotypeReward], `${archetypeId} must reward a canonical phenotype.`);
}
assert.equal(getPhenotypeAbility('terpene-tempest').action, 'flight-burst');
assert.equal(getPhenotypeAbility('hydro-surge').action, 'bubble-form');
assert.equal(getPhenotypeAbility('gravity-haze').action, 'forward-warp');
assert.equal(getPhenotypeAbility('vine-lash').type, 'melee');
assert.equal(getPhenotypeAbility('rootbreaker').type, 'ground');
assert.equal(BOSS_ARCHETYPES.minor.length, 3);
assert.equal(BOSS_ARCHETYPES.major.length, 3);
for (const id of [...BOSS_ARCHETYPES.minor, ...BOSS_ARCHETYPES.major]) {
  assert.ok(ENEMY_ARCHETYPES[id]?.telegraphSeconds >= 0.65, `${id} must telegraph major attacks.`);
}
assert.ok(BOSS_ARCHETYPES.major.some((id) => ENEMY_ARCHETYPES[id].movement === 'flying'), 'Major boss roster should include a flying boss.');
assert.ok(BOSS_ARCHETYPES.major.some((id) => ENEMY_ARCHETYPES[id].movement === 'blink'), 'Major boss roster should include a warp/blink boss.');

let aiState = createCombatState({
  enemies: [
    createEnemyFromArchetype('fungus-gnat', { id: 'flying-test', x: 100, y: 200, patrolMinX: 80, patrolMaxX: 260 }),
    createEnemyFromArchetype('warp-midge', { id: 'blink-test', x: 300, y: 200, patrolMinX: 260, patrolMaxX: 560 }),
    createEnemyFromArchetype('major-boss-warp-weaver', { id: 'boss-test', x: 600, y: 200, patrolMinX: 560, patrolMaxX: 980 })
  ]
});
const flyingStartY = aiState.enemies[0].y;
const blinkStartX = aiState.enemies[1].x;
aiState = advance(aiState, 1.1);
assert.notEqual(aiState.enemies[0].y, flyingStartY, 'Canonical combat should animate flying enemy altitude.');
aiState = advance(aiState, 1.6);
assert.notEqual(aiState.enemies[1].x, blinkStartX, 'Canonical combat should execute deterministic blink movement.');
aiState = advance(aiState, 1.0);
assert.ok(aiState.events.some((event) => event.type === 'enemy-telegraph') || aiState.enemies[2].telegraphTimer > 0, 'Major boss AI should emit readable telegraph state.');
assert.equal(combatSnapshot(aiState).bossesAlive, 1);

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
assert.equal(state.progression.activePhenotype, null, 'Absorbing an enemy power must not overwrite permanent phenotype selection.');
assert.equal(state.progression.absorbedPhenotype, 'static-haze', 'Defeating an elite should absorb its phenotype power.');
assert.ok(state.progression.absorbedPhenotypeRemaining > 29 && state.progression.absorbedPhenotypeRemaining <= 30);
assert.ok(state.progression.discoveredPhenotypes.includes('static-haze'));
assert.equal(state.progression.resources.trichomes, 3);
assert.equal(state.progression.resources['genetic-fragments'], 1);

state = fireActivePhenotype(state, { x: 0, y: 14, facing: 1 });
assert.equal(state.projectiles.at(-1)?.phenotypeId, 'static-haze', 'Absorbed phenotype should immediately become the combat ability.');

state = advance(state, 30.5);
assert.equal(state.progression.absorbedPhenotype, null, 'Absorbed phenotype should expire after 30 seconds.');
assert.equal(state.progression.absorbedPhenotypeRemaining, 0);

progression = acquirePhenotype(createProgressionState(), 'frost-resin');
state = createCombatState({
  progression,
  enemies: [createEnemy({ id: 'aphid', x: 80, y: 0, health: 3 })]
});
state = fireActivePhenotype(state, { x: 0, y: 14, facing: 1 });
state = advance(state, 0.3);
assert.ok(state.enemies[0].statuses.freeze > 0, 'Frost Resin should freeze a hit enemy.');
assert.equal(state.enemies[0].health, 2);

progression = acquirePhenotype(createProgressionState(), 'solar-flare');
state = createCombatState({
  progression,
  enemies: [createEnemy({ id: 'burn-target', x: 80, y: 0, health: 5 })]
});
state = fireActivePhenotype(state, { x: 0, y: 14, facing: 1 });
state = advance(state, 1.5);
assert.ok(state.enemies[0].health <= 2, 'Solar Flare should apply direct plus burn damage over time.');

progression = acquirePhenotype(createProgressionState(), 'static-haze');
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
assert.equal(snapshot.bossesAlive, 0);
assert.equal(snapshot.projectiles, 3);
assert.equal(snapshot.absorbedPhenotype, null);

console.log('Seed Man combat, canonical flying/blink/boss AI, full phenotype action roster, timed absorption, and expiry tests passed');
