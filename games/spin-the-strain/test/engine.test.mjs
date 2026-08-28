import assert from 'node:assert/strict';
import fs from 'node:fs';
import {
  MAX_HISTORY,
  createWheel,
  entriesForMode,
  isValidWheelCode,
  normalizeWheelCode,
  sequence,
  spinWheel
} from '../src/engine.mjs';

const data = JSON.parse(fs.readFileSync(new URL('../data/wheels.json', import.meta.url), 'utf8'));

assert.equal(normalizeWheelCode('ab-cd ef'), 'ABCDEF');
assert.equal(normalizeWheelCode('ABOI01'), 'AB');
assert.equal(isValidWheelCode('ABCDE'), false);
assert.equal(isValidWheelCode('ABCDEF'), true);

for (const mode of data.modes) assert.equal(entriesForMode(data, mode.id).length, 18);
assert.throws(() => createWheel({ code: 'ABCDEF', mode: 'missing' }, data), /Unknown wheel mode/);

const a = sequence({ code: 'SPN842', mode: 'strain-picker', count: 30 }, data);
const b = sequence({ code: 'spn842', mode: 'strain-picker', count: 30 }, data);
assert.deepEqual(a, b, 'Same wheel code and mode must reproduce the same sequence.');
for (let index = 1; index < a.length; index += 1) {
  assert.notEqual(a[index], a[index - 1], 'The wheel must not immediately repeat an entry.');
}

const challengeSequence = sequence({ code: 'SPN842', mode: 'grow-challenge', count: 10 }, data);
assert.notDeepEqual(challengeSequence, a.slice(0, 10), 'Changing wheel mode should change the deterministic sequence.');

let state = createWheel({ code: 'HUB842', mode: 'community-wildcard' }, data);
const original = structuredClone(state);
state = spinWheel(state, data);
assert.deepEqual(original.history, [], 'spinWheel must not mutate the input state.');
assert.equal(state.spinCount, 1);
assert.equal(state.history.length, 1);
assert.equal(state.lastResult.entryId, state.lastEntryId);

for (let index = 0; index < MAX_HISTORY + 8; index += 1) state = spinWheel(state, data);
assert.equal(state.history.length, MAX_HISTORY, 'History should stay capped to the latest results.');
assert.equal(state.history.at(-1).spinNumber, state.spinCount);

console.log('Spin the Strain deterministic engine tests passed.');
