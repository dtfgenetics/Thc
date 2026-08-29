import assert from 'node:assert/strict';
import fs from 'node:fs';
import {
  createExperience,
  fillRegion,
  findHiddenObject,
  isValidSceneCode,
  normalizeSceneCode,
  paletteForCode,
  progressForState,
  resetArtwork,
  scoreExperience,
  selectColor,
  undoFill
} from '../src/engine.mjs';

const data = JSON.parse(fs.readFileSync(new URL('../data/scenes.json', import.meta.url), 'utf8'));
const sceneById = new Map(data.scenes.map((scene) => [scene.id, scene]));

assert.equal(normalizeSceneCode('hj-l8 42'), 'HJL842');
assert.equal(normalizeSceneCode('hi-l8 42'), 'HL842', 'Ambiguous I is intentionally excluded from scene codes.');
assert.equal(isValidSceneCode('HJL84'), false);
assert.equal(isValidSceneCode('HJL842'), true);

const first = createExperience({ code: 'HJL842' }, data);
const repeated = createExperience({ code: 'hjl842' }, data);
assert.deepEqual(first, repeated, 'Same code must reproduce the same scene, prompt, and palette order.');
assert.equal(first.paletteOrder.length, data.palette.length);
assert.equal(new Set(first.paletteOrder).size, data.palette.length);
assert.deepEqual(first.paletteOrder, paletteForCode(first.code, data));
assert.equal(first.score, 0);
assert.equal(first.complete, false);

const scene = sceneById.get(first.sceneId);
assert.ok(scene);
assert.ok(scene.prompts.includes(first.prompt));
const firstRegion = scene.regions[0];
const secondRegion = scene.regions[1];
const firstColor = first.paletteOrder[0];
const secondColor = first.paletteOrder[1];

const beforeColor = structuredClone(first);
const selected = selectColor(first, secondColor, data);
assert.deepEqual(first, beforeColor, 'selectColor must not mutate input.');
assert.equal(selected.selectedColorId, secondColor);
assert.throws(() => selectColor(first, 'not-a-color', data), /Unknown palette color/);

const colored = fillRegion(first, firstRegion, firstColor, data);
assert.deepEqual(first, beforeColor, 'fillRegion must not mutate input.');
assert.equal(colored.fills[firstRegion], firstColor);
assert.equal(colored.score, 10);
assert.equal(colored.undoStack.length, 1);
assert.equal(progressForState(colored, data).colored, 1);

const recolored = fillRegion(colored, firstRegion, secondColor, data);
assert.equal(recolored.fills[firstRegion], secondColor);
assert.equal(recolored.score, 10, 'Recoloring should not increase unique-region score.');
assert.equal(recolored.undoStack.length, 2);
const undoRecolor = undoFill(recolored, data);
assert.equal(undoRecolor.fills[firstRegion], firstColor);
const undoInitial = undoFill(undoRecolor, data);
assert.equal(undoInitial.fills[firstRegion], undefined);
assert.equal(undoInitial.score, 0);

const secondColored = fillRegion(colored, secondRegion, secondColor, data);
assert.equal(secondColored.score, 20);
assert.throws(() => fillRegion(first, 'missing-region', firstColor, data), /Unknown region/);

const hidden = scene.hiddenObjects[0];
const found = findHiddenObject(first, hidden.id, data);
assert.equal(found.foundHidden.length, 1);
assert.equal(found.score, 35);
const foundAgain = findHiddenObject(found, hidden.id, data);
assert.equal(foundAgain.foundHidden.length, 1, 'Hidden-object score must be idempotent.');
assert.equal(foundAgain.score, 35);
assert.throws(() => findHiddenObject(first, 'missing-hidden', data), /Unknown hidden object/);

let complete = createExperience({ code: 'HJL842' }, data);
const completeScene = sceneById.get(complete.sceneId);
for (let index = 0; index < completeScene.regions.length; index += 1) {
  complete = fillRegion(complete, completeScene.regions[index], complete.paletteOrder[index % complete.paletteOrder.length], data);
}
for (const item of completeScene.hiddenObjects) complete = findHiddenObject(complete, item.id, data);
const progress = progressForState(complete, data);
assert.equal(progress.colored, completeScene.regions.length);
assert.equal(progress.found, completeScene.hiddenObjects.length);
assert.equal(progress.percent, 100);
assert.equal(progress.complete, true);
assert.equal(complete.complete, true);
assert.equal(complete.score, (completeScene.regions.length * 10) + (completeScene.hiddenObjects.length * 35) + 100);
assert.equal(scoreExperience(complete, data), complete.score);

const reset = resetArtwork(complete, data);
assert.equal(reset.code, complete.code);
assert.equal(reset.sceneId, complete.sceneId);
assert.equal(reset.prompt, complete.prompt);
assert.deepEqual(reset.fills, {});
assert.deepEqual(reset.foundHidden, []);
assert.deepEqual(reset.undoStack, []);
assert.equal(reset.score, 0);
assert.equal(reset.complete, false);

console.log('High Lines deterministic coloring engine tests passed.');
