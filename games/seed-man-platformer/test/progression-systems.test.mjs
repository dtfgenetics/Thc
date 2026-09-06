import assert from 'node:assert/strict';
import { acquirePhenotype, collectResource, collectWeapon, createProgressionState, equipWeapon } from '../src/systems/player-progression.mjs';
import { getPhenotype, phenotypeProjectile } from '../src/systems/phenotypes.mjs';
import { createWeaponShot, getWeapon } from '../src/systems/weapons.mjs';

let state = createProgressionState();
assert.equal(state.activePhenotype, null);
assert.equal(state.equippedWeapon, null);
assert.equal(state.resources.resin, 0);

state = acquirePhenotype(state, 'frost-resin');
assert.equal(state.activePhenotype, 'frost-resin');
assert.deepStrictEqual(state.discoveredPhenotypes, ['frost-resin']);
state = acquirePhenotype(state, 'static-haze');
assert.equal(state.activePhenotype, 'static-haze');
assert.deepStrictEqual(state.discoveredPhenotypes, ['frost-resin', 'static-haze']);
assert.equal(getPhenotype('static-haze').primary, 'chain-lightning');
const electricShot = phenotypeProjectile('static-haze', -1);
assert.equal(electricShot.effect, 'chain');
assert.ok(electricShot.vx < 0);

state = collectWeapon(state, 'seed-slinger');
assert.equal(state.equippedWeapon, 'seed-slinger');
state = collectWeapon(state, 'rosin-cannon', { autoEquip: false });
assert.deepStrictEqual(state.weapons, ['seed-slinger', 'rosin-cannon']);
state = equipWeapon(state, 'rosin-cannon');
assert.equal(state.equippedWeapon, 'rosin-cannon');
assert.equal(getWeapon('rosin-cannon').mode, 'heavy');
const shot = createWeaponShot('rosin-cannon', { x: 12, y: 30, facing: 1, phenotype: state.activePhenotype });
assert.equal(shot.damage, 4);
assert.equal(shot.phenotype, 'static-haze');
assert.ok(shot.vx > 0);

state = collectResource(state, 'resin', 4);
state = collectResource(state, 'genetic-fragments', 2);
assert.equal(state.resources.resin, 4);
assert.equal(state.resources['genetic-fragments'], 2);
assert.throws(() => collectResource(state, 'fake-resource', 1), /unknown resource type/);
assert.throws(() => equipWeapon(state, 'not-owned'), /weapon not owned/);

console.log('Seed Man phenotype, weapon, and resource progression systems passed');
