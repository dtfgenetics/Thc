import assert from 'node:assert/strict';
import fs from 'node:fs';
import { createTrial } from '../src/engine.mjs';
import {
  EXACT_CONFIDENCE_BONUS,
  MAX_CONFIDENCE_CALLS,
  NEAR_CONFIDENCE_BONUS,
  confidenceBonusForResult,
  submitConfidentScorecard
} from '../src/confidence.mjs';

const data = JSON.parse(fs.readFileSync(new URL('../data/trials.json', import.meta.url), 'utf8'));
const entryById = new Map(data.entries.map((entry) => [entry.id, entry]));
const categoryIds = data.categories.map((category) => category.id);

assert.equal(MAX_CONFIDENCE_CALLS, 2);
assert.equal(EXACT_CONFIDENCE_BONUS, 6);
assert.equal(NEAR_CONFIDENCE_BONUS, 3);

const trial = createTrial({ code: 'TRZ842' }, data);
const entry = entryById.get(trial.currentEntryId);
const confidenceIds = categoryIds.slice(0, 2);
const before = structuredClone(trial);
const perfect = submitConfidentScorecard(trial, entry.scores, confidenceIds, data);
assert.deepEqual(trial, before, 'confidence submission must not mutate its input state');
assert.equal(perfect.status, 'review');
assert.deepEqual(perfect.lastResult.confidenceIds, confidenceIds);
assert.equal(perfect.lastResult.confidenceBonus, 12);
assert.equal(perfect.lastResult.points, 140);
assert.equal(perfect.totalPoints, 140);
assert.equal(perfect.history[0].confidenceBonus, 12);
for (const id of confidenceIds) {
  assert.equal(perfect.lastResult.confidenceCalls[id].difference, 0);
  assert.equal(perfect.lastResult.confidenceCalls[id].bonus, EXACT_CONFIDENCE_BONUS);
}

const nearScores = structuredClone(entry.scores);
for (const id of confidenceIds) {
  nearScores[id] = nearScores[id] > 1 ? nearScores[id] - 1 : nearScores[id] + 1;
}
const nearTrial = createTrial({ code: 'TRZ842' }, data);
const near = submitConfidentScorecard(nearTrial, nearScores, confidenceIds, data);
assert.equal(near.lastResult.confidenceBonus, 6);
for (const id of confidenceIds) {
  assert.equal(near.lastResult.confidenceCalls[id].difference, 1);
  assert.equal(near.lastResult.confidenceCalls[id].bonus, NEAR_CONFIDENCE_BONUS);
}

const noConfidence = submitConfidentScorecard(createTrial({ code: 'TRZ842' }, data), entry.scores, [], data);
assert.equal(noConfidence.lastResult.confidenceBonus, 0);
assert.deepEqual(noConfidence.lastResult.confidenceIds, []);

assert.throws(
  () => confidenceBonusForResult(perfect.lastResult, [categoryIds[0], categoryIds[0]], data),
  /unique/
);
assert.throws(
  () => confidenceBonusForResult(perfect.lastResult, categoryIds.slice(0, 3), data),
  /at most 2/
);
assert.throws(
  () => confidenceBonusForResult(perfect.lastResult, ['not-a-category'], data),
  /Unknown confidence category/
);

console.log('Trichome Trials confidence-call tests passed.');
