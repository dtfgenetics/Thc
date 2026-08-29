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

const a = sequence({ code: 'SPN842', mode: 'strain-picker', count: 36 }, data);
const b = sequence({ code: 'spn842', mode: 'strain-picker', count: 36 }, data);
assert.deepEqual(a, b, 'Same wheel code and mode must reproduce the same sequence.');
assert.equal(new Set(a.slice(0, 18)).size, 18, 'First cycle must show every entry exactly once.');
assert.equal(new Set(a.slice(18, 36)).size, 18, 'Second cycle must also show every entry exactly once.');
for (let index = 1; index < a.length; index += 1) {
  assert.notEqual(a[index], a[index - 1], 'Adjacent spins must not repeat an entry.');
}

const challengeSequence = sequence({ code: 'SPN842', mode: 'grow-challenge', count: 18 }, data);
assert.equal(new Set(challengeSequence).size, 18, 'Every mode should exhaust its full pool before repeating.');
assert.notDeepEqual(challengeSequence.slice(0, 10), a.slice(0, 10), 'Changing wheel mode should change the deterministic sequence.');

let state = createWheel({ code: 'HUB842', mode: 'community-wildcard' }, data);
const original = structuredClone(state);
state = spinWheel(state, data);
assert.deepEqual(original.history, [], 'spinWheel must not mutate the input state.');
assert.equal(state.spinCount, 1);
assert.equal(state.cycleNumber, 1);
assert.equal(state.cycleSeenEntryIds.length, 1);
assert.equal(state.history.length, 1);
assert.equal(state.lastResult.entryId, state.lastEntryId);
assert.equal(state.lastResult.cyclePosition, 1);
assert.equal(state.lastResult.cycleSize, 18);

for (let index = 1; index < 18; index += 1) state = spinWheel(state, data);
assert.equal(state.cycleNumber, 1);
assert.equal(state.cycleSeenEntryIds.length, 18);
assert.equal(new Set(state.cycleSeenEntryIds).size, 18);
assert.equal(state.lastResult.cyclePosition, 18);

const completedCycleIds = new Set(state.cycleSeenEntryIds);
state = spinWheel(state, data);
assert.equal(state.cycleNumber, 2, 'Nineteenth spin should start a new cycle.');
assert.equal(state.cycleSeenEntryIds.length, 1);
assert.equal(state.lastResult.cycleNumber, 2);
assert.equal(state.lastResult.cyclePosition, 1);
assert.ok(completedCycleIds.has(state.lastResult.entryId), 'A new cycle may reuse entries from the completed cycle.');

for (let index = 0; index < MAX_HISTORY + 8; index += 1) state = spinWheel(state, data);
assert.equal(state.history.length, MAX_HISTORY, 'History should stay capped to the latest results.');
assert.equal(state.history.at(-1).spinNumber, state.spinCount);
assert.ok(state.cycleSeenEntryIds.length <= 18, 'Cycle tracking must be independent of capped history.');

console.log('Spin the Strain deterministic no-repeat-cycle tests passed.');
