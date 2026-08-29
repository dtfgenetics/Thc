import assert from 'node:assert/strict';
import fs from 'node:fs';
import {
  advanceTrial,
  averageAccuracy,
  createTrial,
  isValidTrialCode,
  judgeRank,
  normalizeTrialCode,
  scoreScorecard,
  submitScorecard,
  trialEntryOrder,
  validateScorecard
} from '../src/engine.mjs';

const data = JSON.parse(fs.readFileSync(new URL('../data/trials.json', import.meta.url), 'utf8'));
const entryById = new Map(data.entries.map((entry) => [entry.id, entry]));

assert.equal(normalizeTrialCode(' tri 842 '), 'TR842');
assert.equal(normalizeTrialCode('tr-i842'), 'TR842');
assert.equal(normalizeTrialCode('trz842'), 'TRZ842');
assert.equal(isValidTrialCode('TR842'), false);
assert.equal(isValidTrialCode('TRZ842'), true);

const orderA = trialEntryOrder('TRZ842', data);
const orderB = trialEntryOrder('trz842', data);
assert.deepEqual(orderA, orderB, 'Same trial code must reproduce the same entry order.');
assert.equal(orderA.length, data.roundsPerRun);
assert.equal(new Set(orderA).size, orderA.length, 'A run must not repeat an entry.');

const first = createTrial({ code: 'TRZ842' }, data);
assert.equal(first.round, 1);
assert.equal(first.status, 'judging');
assert.equal(first.currentEntryId, orderA[0]);
assert.equal(first.history.length, 0);

const firstEntry = entryById.get(first.currentEntryId);
const clean = validateScorecard(firstEntry.scores, data);
assert.deepEqual(clean, firstEntry.scores);
assert.throws(() => validateScorecard({ ...firstEntry.scores, structure: 0 }, data), /Structure/);
assert.throws(() => validateScorecard({ ...firstEntry.scores, resin: 11 }, data), /Resin/);
assert.throws(() => validateScorecard({ ...firstEntry.scores, terps: 7.5 }, data), /Terps/);

const perfect = scoreScorecard(firstEntry.scores, firstEntry.scores, data);
assert.equal(perfect.totalError, 0);
assert.equal(perfect.accuracy, 100);
assert.equal(perfect.exactCount, 7);
assert.equal(perfect.nearCount, 0);
assert.equal(perfect.points, 128);

const nearCard = Object.fromEntries(data.categories.map((category) => [category.id, Math.max(1, firstEntry.scores[category.id] - 1)]));
const near = scoreScorecard(nearCard, firstEntry.scores, data);
assert.ok(near.accuracy < 100);
assert.ok(near.accuracy >= 85);
assert.ok(near.exactCount + near.nearCount >= 6);

const beforeSubmit = structuredClone(first);
const reviewed = submitScorecard(first, firstEntry.scores, data);
assert.deepEqual(first, beforeSubmit, 'submitScorecard must not mutate its input state.');
assert.equal(reviewed.status, 'review');
assert.equal(reviewed.history.length, 1);
assert.equal(reviewed.totalPoints, 128);
assert.equal(reviewed.accuracyTotal, 100);
assert.equal(reviewed.exactCalls, 7);
assert.equal(reviewed.lastResult.entryId, firstEntry.id);
assert.throws(() => submitScorecard(reviewed, firstEntry.scores, data), /not accepting/);

const second = advanceTrial(reviewed, data);
assert.equal(second.status, 'judging');
assert.equal(second.round, 2);
assert.equal(second.currentEntryId, orderA[1]);
assert.equal(second.lastResult, null);
assert.throws(() => advanceTrial(second, data), /Review/);

let perfectRun = createTrial({ code: 'TRZ842' }, data);
while (perfectRun.status !== 'complete') {
  const entry = entryById.get(perfectRun.currentEntryId);
  perfectRun = submitScorecard(perfectRun, entry.scores, data);
  perfectRun = advanceTrial(perfectRun, data);
}
assert.equal(perfectRun.history.length, data.roundsPerRun);
assert.equal(perfectRun.exactCalls, data.roundsPerRun * data.categories.length);
assert.equal(averageAccuracy(perfectRun), 100);
assert.equal(judgeRank(perfectRun), 'Head Judge');
assert.equal(perfectRun.currentEntryId, null);

assert.equal(judgeRank({ history:[{}], accuracyTotal:90, exactCalls:5 }), 'Trial Judge');
assert.equal(judgeRank({ history:[{}], accuracyTotal:70, exactCalls:0 }), 'Scorekeeper');
assert.equal(judgeRank({ history:[{}], accuracyTotal:50, exactCalls:0 }), 'Judge in Training');

console.log('Trichome Trials deterministic scoring tests passed.');
