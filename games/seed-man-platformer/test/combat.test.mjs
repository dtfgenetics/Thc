import assert from 'node:assert/strict';
import { absorbPhenotype, collectWeapon, createProgressionState } from '../src/systems/player-progression.mjs';
import {
  createCombatState,
  createEnemy,
  fireEquippedWeapon,
  fireActivePhenotype,
  stepCombat,
  combatSnapshot
} from '../src/systems/combat.mjs';
import { CANONICAL_PHENOTYPE_IDS, PHENOTYPES, PHENOTYPE_ABILITIES } from '../src/systems/phenotypes.mjs';
import {
  ENEMY_ARCHETYPES,
  LEVEL_01_COMBAT_ENCOUNTERS,
  PHENOTYPE_CARRIER_ARCHETYPES,
  BOSS_ARCHETYPES,
  createEnemyFromArchetype,
  instantiateEncounterSet
} from '../src/systems/enemy-archetypes.mjs';

const COMMON_ENEMIES = ['sproutling','root-crawler','toxic-spore','drone-bot','thorn-beetle','sky-wasp','spike-plant','sludge-monster','bone-weed','shadow-root'];
const TEMPORARY_FORMS = ['fire','electric','ice'];
const EXPECTED_BOSSES = ['overgrown-guardian','ancient-dryad','scorchroot-titan','frostbite-colossus','eco-sentinel','blight-king'];
const RETIRED_IDS = ['solar-flare','static-haze','frost-resin','hydro-surge','terpene-tempest','vine-lash','mycelium-mind','rootbreaker','trichome-crystal','gravity-haze'];

function advance(state, seconds, dt = 1 / 60) {
  let next = state;
  for (let elapsed = 0; elapsed < seconds; elapsed += dt) next = stepCombat(next, dt);
  return next;
}

assert.deepStrictEqual(CANONICAL_PHENOTYPE_IDS, ['plant','fire','electric','ice']);
assert.equal(Object.keys(PHENOTYPES).length, 4);
assert.equal(Object.keys(PHENOTYPE_ABILITIES).length, 4);
for (const retired of RETIRED_IDS) assert.equal(PHENOTYPES[retired], undefined, `retired phenotype must stay removed: ${retired}`);

assert.equal(Object.keys(ENEMY_ARCHETYPES).length, 19, 'v20 source roster must contain 10 common enemies, 3 phenotype carriers, and 6 bosses.');
for (const id of COMMON_ENEMIES) assert.ok(ENEMY_ARCHETYPES[id], `missing canonical common enemy: ${id}`);
assert.deepStrictEqual(PHENOTYPE_CARRIER_ARCHETYPES, ['fire-carrier','electric-carrier','ice-carrier']);
assert.deepStrictEqual(BOSS_ARCHETYPES, EXPECTED_BOSSES);
for (const [index, carrierId] of PHENOTYPE_CARRIER_ARCHETYPES.entries()) {
  const carrier = ENEMY_ARCHETYPES[carrierId];
  assert.equal(carrier.rank, 'elite');
  assert.equal(carrier.phenotypeReward, TEMPORARY_FORMS[index]);
}
assert.equal(ENEMY_ARCHETYPES['overgrown-guardian'].health, 32);
assert.equal(ENEMY_ARCHETYPES['ancient-dryad'].health, 36);
assert.equal(ENEMY_ARCHETYPES['scorchroot-titan'].health, 40);
assert.equal(ENEMY_ARCHETYPES['frostbite-colossus'].health, 44);
assert.equal(ENEMY_ARCHETYPES['eco-sentinel'].health, 48);
assert.equal(ENEMY_ARCHETYPES['blight-king'].health, 96);
assert.equal(ENEMY_ARCHETYPES['blight-king'].phases, 4);
assert.equal(ENEMY_ARCHETYPES['blight-king'].finalBoss, true);

const authoredEncounters = instantiateEncounterSet();
assert.equal(authoredEncounters.length, LEVEL_01_COMBAT_ENCOUNTERS.length);
assert.ok(authoredEncounters.some((enemy) => enemy.movement === 'flying'), 'Level 1 deterministic encounter coverage must include a flying enemy.');
assert.ok(authoredEncounters.every((enemy) => COMMON_ENEMIES.includes(enemy.kind)), 'Level 1 deterministic encounter coverage must use only canonical common enemies.');

let aiState = createCombatState({
  enemies: [
    createEnemyFromArchetype('drone-bot', { id:'flying-test', x:100, y:200, patrolMinX:80, patrolMaxX:300 }),
    createEnemyFromArchetype('shadow-root', { id:'blink-test', x:330, y:200, patrolMinX:300, patrolMaxX:620 }),
    createEnemyFromArchetype('blight-king', { id:'boss-test', x:700, y:200, patrolMinX:640, patrolMaxX:1100 })
  ]
});
const flyingStartY = aiState.enemies[0].y;
const blinkStartX = aiState.enemies[1].x;
aiState = advance(aiState, 1.1);
assert.notEqual(aiState.enemies[0].y, flyingStartY, 'Drone Bot should animate deterministic flying motion.');
aiState = advance(aiState, 1.2);
assert.notEqual(aiState.enemies[1].x, blinkStartX, 'Shadow Root should execute deterministic blink movement.');
aiState = advance(aiState, 1.2);
assert.ok(aiState.events.some((event) => event.type === 'enemy-telegraph') || aiState.enemies[2].telegraphTimer > 0, 'Blight King should expose readable telegraph state.');
assert.equal(combatSnapshot(aiState).bossesAlive, 1);

let progression = collectWeapon(createProgressionState(), 'seed-slinger');
let state = createCombatState({
  progression,
  enemies: [createEnemy({
    id:'electric-carrier-test',
    kind:'electric-carrier',
    rank:'elite',
    x:120,
    y:0,
    width:28,
    height:28,
    health:2,
    phenotypeReward:'electric',
    drops:{trichomes:3,'genetic-fragments':1}
  })]
});

state = fireEquippedWeapon(state, { x:0, y:14, facing:1 });
assert.equal(state.projectiles.length, 1);
state = advance(state, 0.3);
assert.equal(state.enemies[0].health, 1);
state = advance(state, 0.2);
state = fireEquippedWeapon(state, { x:0, y:14, facing:1 });
state = advance(state, 0.3);
assert.equal(state.enemies[0].defeated, true);
assert.equal(state.progression.activePhenotype, 'plant');
assert.equal(state.progression.absorbedPhenotype, 'electric');
assert.ok(state.progression.absorbedPhenotypeRemaining > 29 && state.progression.absorbedPhenotypeRemaining <= 30);
assert.ok(state.progression.discoveredPhenotypes.includes('electric'));
assert.equal(state.progression.resources.trichomes, 3);
assert.equal(state.progression.resources['genetic-fragments'], 1);

state = createCombatState({
  progression: absorbPhenotype(collectWeapon(createProgressionState(), 'seed-slinger'), 'electric'),
  enemies:[
    createEnemy({ id:'chain-a', x:80, y:0, health:2 }),
    createEnemy({ id:'chain-b', x:150, y:0, health:2 })
  ]
});
state = fireActivePhenotype(state, { x:0, y:14, facing:1 });
state = advance(state, 0.25);
assert.equal(state.enemies[0].health, 1, 'Electric should damage the direct target.');
assert.equal(state.enemies[1].health, 1, 'Electric should chain to a nearby second target.');

state = createCombatState({
  progression: absorbPhenotype(createProgressionState(), 'ice'),
  enemies:[createEnemy({ id:'freeze-target', x:80, y:0, health:3 })]
});
state = fireActivePhenotype(state, { x:0, y:14, facing:1 });
state = advance(state, 0.3);
assert.ok(state.enemies[0].statuses.freeze > 0, 'Ice should freeze a hit enemy.');
assert.equal(state.enemies[0].health, 2);

state = createCombatState({
  progression: absorbPhenotype(createProgressionState(), 'fire'),
  enemies:[createEnemy({ id:'burn-target', x:80, y:0, health:5 })]
});
state = fireActivePhenotype(state, { x:0, y:14, facing:1 });
state = advance(state, 1.5);
assert.ok(state.enemies[0].health <= 2, 'Fire should apply direct plus burn damage over time.');

state = createCombatState({ progression:absorbPhenotype(createProgressionState(), 'fire') });
state = advance(state, 30.5);
assert.equal(state.progression.absorbedPhenotype, null, 'Temporary phenotype must expire after 30 seconds.');
assert.equal(state.progression.absorbedPhenotypeRemaining, 0);
assert.equal(state.progression.activePhenotype, 'plant');

const plantState = fireActivePhenotype(createCombatState({ progression:createProgressionState() }), { x:0, y:14, facing:1 });
assert.equal(plantState.projectiles.at(-1)?.phenotypeId, 'plant', 'Plant must remain the permanent base attack form.');

console.log('Seed Man canonical v20 source combat roster, enemies, bosses, Plant/Fire/Electric/Ice combat, AI, absorption, and expiry tests passed');
