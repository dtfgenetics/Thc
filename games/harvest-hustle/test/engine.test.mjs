import assert from 'node:assert/strict';
import fs from 'node:fs';
import {
  MAX_HISTORY,
  advanceTime,
  applyStation,
  batchIdForIndex,
  createShift,
  expectedStationId,
  isValidShiftCode,
  normalizeShiftCode,
  shiftRank
} from '../src/engine.mjs';

const data = JSON.parse(fs.readFileSync(new URL('../data/shift.json', import.meta.url), 'utf8'));

assert.equal(normalizeShiftCode(' h-st 842 '), 'HST842');
assert.equal(isValidShiftCode('HST84'), false);
assert.equal(isValidShiftCode('HST842'), true);

const first = createShift({ code: 'HST842' }, data);
const repeated = createShift({ code: 'hst842' }, data);
assert.deepEqual(first.queue, repeated.queue, 'Same code must reproduce the same opening queue.');
assert.equal(first.queue.length, data.queueSize);
assert.equal(first.timeRemaining, data.shiftSeconds);
assert.equal(first.nextBatchIndex, data.queueSize);

const sequence = Array.from({ length: 40 }, (_, index) => batchIdForIndex('HST842', index, data));
for (let index = 1; index < sequence.length; index += 1) {
  assert.notEqual(sequence[index], sequence[index - 1], `Adjacent batch repeat at index ${index}.`);
}

const opening = structuredClone(first);
const firstBatch = first.queue[0];
assert.equal(expectedStationId(firstBatch, data), 'tag');
const afterCorrect = applyStation(first, { instanceId: firstBatch.instanceId, stationId: 'tag' }, data);
assert.deepEqual(first, opening, 'applyStation must not mutate its input state.');
assert.equal(afterCorrect.lastAction.correct, true);
assert.equal(afterCorrect.combo, 1);
assert.equal(afterCorrect.bestCombo, 1);
assert.equal(afterCorrect.timeRemaining, data.shiftSeconds - 1);
assert.equal(afterCorrect.queue[0].stepIndex, 1);
assert.ok(afterCorrect.score > 0);

const afterWrong = applyStation(first, { instanceId: firstBatch.instanceId, stationId: 'trim' }, data);
assert.equal(afterWrong.lastAction.correct, false);
assert.equal(afterWrong.mistakes, 1);
assert.equal(afterWrong.combo, 0);
assert.equal(afterWrong.queue[0].quality, 90);
assert.equal(afterWrong.timeRemaining, data.shiftSeconds - 3);
assert.equal(afterWrong.lastAction.qualityPenalty, 10);

let completionRun = createShift({ code: 'HST842' }, data);
const completingId = completionRun.queue[0].instanceId;
while (completionRun.status === 'playing' && completionRun.queue.some((batch) => batch.instanceId === completingId)) {
  const target = completionRun.queue.find((batch) => batch.instanceId === completingId);
  completionRun = applyStation(
    completionRun,
    { instanceId: completingId, stationId: expectedStationId(target, data) },
    data
  );
}
assert.equal(completionRun.completed, 1);
assert.equal(completionRun.queue.length, data.queueSize, 'Completed batch should be replaced while the shift is active.');
assert.equal(completionRun.nextBatchIndex, data.queueSize + 1);
assert.ok(completionRun.lastAction.completedBatch);
assert.equal(completionRun.lastAction.completedBatch.quality, 100);
assert.ok(completionRun.lastAction.completionScore > 0);

const patienceRun = createShift({ code: 'HST842' }, data);
const patience = patienceRun.queue[0].patienceRemaining;
const late = advanceTime(patienceRun, patience + 2, data);
assert.equal(late.queue[0].patienceRemaining, -2);
assert.equal(late.queue[0].quality, 96, 'Two late game-seconds should cost four quality points.');
assert.deepEqual(patienceRun.queue[0].quality, 100, 'advanceTime must not mutate input state.');

const expired = advanceTime(createShift({ code: 'HST842' }, data), 999, data);
assert.equal(expired.status, 'complete');
assert.equal(expired.timeRemaining, 0);
assert.equal(expired.elapsed, data.shiftSeconds);

let historyRun = createShift({ code: 'HST842' }, data);
for (let index = 0; index < 20 && historyRun.status === 'playing'; index += 1) {
  historyRun = applyStation(historyRun, { instanceId: historyRun.queue[0].instanceId, stationId: 'trim' }, data);
}
assert.equal(historyRun.history.length, MAX_HISTORY);

assert.equal(shiftRank({ completed: 0, score: 0, mistakes: 0 }), 'Rookie');
assert.equal(shiftRank({ completed: 5, score: 800, mistakes: 0 }), 'Shift Pro');
assert.equal(shiftRank({ completed: 8, score: 1300, mistakes: 1 }), 'Trim Ace');
assert.equal(shiftRank({ completed: 10, score: 2000, mistakes: 0 }), 'Room Captain');

console.log('Harvest Hustle deterministic engine tests passed.');
