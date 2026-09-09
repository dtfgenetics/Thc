import assert from 'node:assert/strict';
import {
  acquirePhenotype,
  absorbPhenotype,
  collectResource,
  collectWeapon,
  createProgressionState,
  equipWeapon,
  getEffectivePhenotype,
  normalizeProgressionState,
  stepPhenotypeAbsorption
} from '../src/systems/player-progression.mjs';
import { CANONICAL_PHENOTYPE_IDS, getPhenotype, phenotypeProjectile } from '../src/systems/phenotypes.mjs';
import { createWeaponShot, getWeapon } from '../src/systems/weapons.mjs';

const nullSafe = normalizeProgressionState(null);
assert.deepStrictEqual(nullSafe, createProgressionState(), 'Null progression input should safely normalize to a clean default state.');
assert.deepStrictEqual(CANONICAL_PHENOTYPE_IDS,['plant','fire','electric','ice']);

let state = createProgressionState();
assert.equal(state.activePhenotype, 'plant');
assert.equal(state.absorbedPhenotype, null);
assert.equal(state.absorbedPhenotypeRemaining, 0);
assert.deepStrictEqual(state.discoveredPhenotypes,['plant']);
assert.equal(state.equippedWeapon, null);
assert.equal(state.resources.resin, 0);

state = acquirePhenotype(state, 'plant');
assert.equal(state.activePhenotype, 'plant');
assert.equal(getEffectivePhenotype(state), 'plant');

state = absorbPhenotype(state, 'electric');
assert.equal(state.activePhenotype, 'plant', 'Plant must remain the permanent base form.');
assert.equal(state.absorbedPhenotype, 'electric');
assert.equal(state.absorbedPhenotypeRemaining, 30);
assert.equal(getEffectivePhenotype(state), 'electric', 'Absorbed phenotype should override Plant while active.');
assert.deepStrictEqual(state.discoveredPhenotypes, ['plant', 'electric']);
state = stepPhenotypeAbsorption(state, 12.5);
assert.equal(state.absorbedPhenotype, 'electric');
assert.ok(Math.abs(state.absorbedPhenotypeRemaining - 17.5) < 0.001);
state = stepPhenotypeAbsorption(state, 18);
assert.equal(state.absorbedPhenotype, null);
assert.equal(state.absorbedPhenotypeRemaining, 0);
assert.equal(getEffectivePhenotype(state), 'plant', 'Plant must return after absorbed form expires.');

state = absorbPhenotype(state, 'fire');
assert.equal(getPhenotype('fire').primary, 'fireball');
const fireShot = phenotypeProjectile('fire', -1);
assert.equal(fireShot.effect, 'burn');
assert.ok(fireShot.vx < 0);
state = absorbPhenotype(state, 'ice');
const iceShot = phenotypeProjectile('ice', 1);
assert.equal(iceShot.effect, 'freeze');
assert.ok(iceShot.vx > 0);
assert.throws(() => absorbPhenotype(state,'static-haze'),/unknown phenotype/);
assert.throws(() => absorbPhenotype(state,'plant'),/cannot be absorbed temporarily/);

state = collectWeapon(state, 'seed-slinger');
assert.equal(state.equippedWeapon, 'seed-slinger');
state = collectWeapon(state, 'rosin-cannon', { autoEquip: false });
assert.deepStrictEqual(state.weapons, ['seed-slinger', 'rosin-cannon']);
state = equipWeapon(state, 'rosin-cannon');
assert.equal(state.equippedWeapon, 'rosin-cannon');
assert.equal(getWeapon('rosin-cannon').mode, 'heavy');
const shot = createWeaponShot('rosin-cannon', { x: 12, y: 30, facing: 1, phenotype: getEffectivePhenotype(state) });
assert.equal(shot.damage, 4);
assert.equal(shot.phenotype, 'ice');
assert.ok(shot.vx > 0);

state = collectResource(state, 'resin', 4);
state = collectResource(state, 'genetic-fragments', 2);
assert.equal(state.resources.resin, 4);
assert.equal(state.resources['genetic-fragments'], 2);
assert.throws(() => collectResource(state, 'fake-resource', 1), /unknown resource type/);
assert.throws(() => equipWeapon(state, 'not-owned'), /weapon not owned/);

console.log('Seed Man v20 progression, canonical phenotype absorption, weapon, and resource systems passed');
