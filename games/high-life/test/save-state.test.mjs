import assert from 'node:assert/strict';
import { isRecoverableHighLifeState } from '../src/save-state.mjs';

const MAX_TURNS = 18;
const resources = { cash: 4, reputation: 8 };

assert.equal(isRecoverableHighLifeState({ turn: 0, complete: false, resources }, MAX_TURNS), true);
assert.equal(isRecoverableHighLifeState({ turn: 17, complete: false, resources }, MAX_TURNS), true);
assert.equal(isRecoverableHighLifeState({ turn: 18, complete: true, finalScore: 122, resources }, MAX_TURNS), true);

assert.equal(isRecoverableHighLifeState({ turn: 18, complete: false, resources }, MAX_TURNS), false);
assert.equal(isRecoverableHighLifeState({ turn: 17, complete: true, finalScore: 110, resources }, MAX_TURNS), false);
assert.equal(isRecoverableHighLifeState({ turn: 18, complete: true, finalScore: null, resources }, MAX_TURNS), false);
assert.equal(isRecoverableHighLifeState({ turn: 19, complete: true, finalScore: 140, resources }, MAX_TURNS), false);
assert.equal(isRecoverableHighLifeState({ turn: 2, complete: false }, MAX_TURNS), false);

console.log('High Life save-state recovery tests passed.');
