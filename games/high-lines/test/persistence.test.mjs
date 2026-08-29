import assert from 'node:assert/strict';
import fs from 'node:fs';
import { createExperience, fillRegion, findHiddenObject, selectColor } from '../src/engine.mjs';
import {
  SAVE_KEY_PREFIX,
  SAVE_SCHEMA_VERSION,
  experienceSavePayload,
  hasSavedProgress,
  restoreExperience,
  saveKeyForCode
} from '../src/persistence.mjs';

const data = JSON.parse(fs.readFileSync(new URL('../data/scenes.json', import.meta.url), 'utf8'));
const sceneById = new Map(data.scenes.map((scene) => [scene.id, scene]));

let state = createExperience({ code: 'HJL842' }, data);
const scene = sceneById.get(state.sceneId);
const firstColor = state.paletteOrder[0];
const secondColor = state.paletteOrder[1];
state = fillRegion(state, scene.regions[0], firstColor, data);
state = fillRegion(state, scene.regions[1], secondColor, data);
state = findHiddenObject(state, scene.hiddenObjects[0].id, data);
state = selectColor(state, secondColor, data);

const before = structuredClone(state);
const payload = experienceSavePayload(state);
assert.deepEqual(state, before, 'creating a save payload must not mutate state');
assert.equal(payload.schemaVersion, SAVE_SCHEMA_VERSION);
assert.equal(payload.code, 'HJL842');
assert.equal(payload.selectedColorId, secondColor);
assert.equal(Object.keys(payload.fills).length, 2);
assert.equal(payload.foundHidden.length, 1);
assert.equal(hasSavedProgress(payload), true);
assert.equal(saveKeyForCode('hjl842'), `${SAVE_KEY_PREFIX}HJL842`);

const restored = restoreExperience(payload, data);
assert.equal(restored.code, state.code);
assert.equal(restored.sceneId, state.sceneId);
assert.equal(restored.prompt, state.prompt);
assert.deepEqual(restored.paletteOrder, state.paletteOrder);
assert.equal(restored.selectedColorId, secondColor);
assert.deepEqual(restored.fills, state.fills);
assert.deepEqual(restored.foundHidden, state.foundHidden);
assert.equal(restored.score, state.score);
assert.equal(restored.complete, state.complete);
assert.deepEqual(restored.undoStack, [], 'undo history should not cross reload boundaries');

const blankPayload = experienceSavePayload(createExperience({ code: 'HJL842' }, data));
assert.equal(hasSavedProgress(blankPayload), false);

assert.throws(() => saveKeyForCode('bad'), /valid High Lines scene code/);
assert.throws(() => restoreExperience({ ...payload, schemaVersion: 99 }, data), /Unsupported/);
assert.throws(() => restoreExperience({ ...payload, selectedColorId: 'fake-color' }, data), /color is invalid/);
assert.throws(() => restoreExperience({ ...payload, fills: { ...payload.fills, fake: firstColor } }, data), /region is invalid/);
assert.throws(() => restoreExperience({ ...payload, fills: { ...payload.fills, [scene.regions[0]]: 'fake-color' } }, data), /fill color is invalid/);
assert.throws(() => restoreExperience({ ...payload, foundHidden: [...payload.foundHidden, 'fake-hidden'] }, data), /hidden object is invalid/);
assert.throws(() => restoreExperience({ ...payload, foundHidden: [scene.hiddenObjects[0].id, scene.hiddenObjects[0].id] }, data), /list is invalid/);

console.log('High Lines persistence tests passed.');
