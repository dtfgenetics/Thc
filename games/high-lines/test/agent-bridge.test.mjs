import assert from 'node:assert/strict';
import fs from 'node:fs';
import {
  createExperience,
  fillRegion,
  findHiddenObject,
  createAgentObservation
} from '../src/engine.mjs';

const data = JSON.parse(fs.readFileSync(new URL('../data/scenes.json', import.meta.url), 'utf8'));
const runtime = fs.readFileSync(new URL('../../../site/public-route-patch/games/high-lines/runtime.mjs', import.meta.url), 'utf8');

assert.match(runtime, /high-lines-controllable-v1/);
assert.match(runtime, /__HIGH_LINES_AGENT__/);
assert.match(runtime, /snapshot:\s*highLinesAgentSnapshot/);
assert.doesNotMatch(runtime, /__HIGH_LINES_AGENT__[\s\S]{0,1000}(?:fillRegion|findHiddenObject|selectColor|undoFill)\s*:/);

let state = createExperience({ code: 'HJL842' }, data);
let snapshot = createAgentObservation(state, data);
assert.equal(snapshot.version, 'high-lines-observable-v1');
assert.equal(snapshot.gameId, 'high-lines');
assert.equal(snapshot.ready, true);
assert.equal(snapshot.phase, 'active');
assert.deepEqual(snapshot.capabilities, ['snapshot']);
assert.equal(snapshot.progress.foundHidden, 0);

const scene = data.scenes.find((candidate) => candidate.id === state.sceneId);
const hiddenIds = scene.hiddenObjects.map((item) => item.id);
const serializedInitial = JSON.stringify(snapshot);
for (const hiddenId of hiddenIds) {
  assert.equal(serializedInitial.includes(hiddenId), false, 'observable state must not expose hidden-object identities');
}

state = fillRegion(state, scene.regions[0], state.paletteOrder[0], data);
snapshot = createAgentObservation(state, data);
assert.equal(snapshot.progress.colored, 1);
assert.equal(snapshot.fills[scene.regions[0]], state.paletteOrder[0]);

state = findHiddenObject(state, hiddenIds[0], data);
snapshot = createAgentObservation(state, data);
assert.equal(snapshot.progress.foundHidden, 1);
const serializedFound = JSON.stringify(snapshot);
for (const hiddenId of hiddenIds) {
  assert.equal(serializedFound.includes(hiddenId), false, 'even found-object IDs stay out of the generic agent snapshot');
}

const mutated = snapshot.fills;
mutated.synthetic = 'bad';
assert.equal(state.fills.synthetic, undefined, 'snapshot must not expose mutable engine state');

console.log('High Lines read-only autonomous playtest observation contract passed.');
