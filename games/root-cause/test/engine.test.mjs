import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  RUN_ROUNDS,
  MAX_INSPECTIONS,
  createRun,
  currentCase,
  diagnose,
  inspect,
  advanceCase,
  normalizeRootCode,
  isValidRootCode,
  runGrade
} from '../src/engine.mjs';

const here = path.dirname(fileURLToPath(import.meta.url));
const data = JSON.parse(fs.readFileSync(path.resolve(here, '../data/cases.json'), 'utf8'));

assert.equal(normalizeRootCode(' abio01-cd23 '), 'ABCD23');
assert.equal(isValidRootCode('ABCD23'), true);
assert.equal(isValidRootCode('ABC23'), false);

const first = createRun({ code: 'GR8W42' }, data);
const second = createRun({ code: 'GR8W42' }, data);
assert.deepEqual(first.caseOrder, second.caseOrder);
assert.equal(first.caseOrder.length, RUN_ROUNDS);
assert.equal(new Set(first.caseOrder).size, RUN_ROUNDS);
assert.deepEqual(first.current.diagnoses, second.current.diagnoses);
assert.deepEqual(first.current.inspections, second.current.inspections);

const different = createRun({ code: 'LASS42' }, data);
assert.notDeepEqual(first.caseOrder, different.caseOrder);

const original = structuredClone(first);
const oneInspection = inspect(first, first.current.inspections[0], data);
assert.deepEqual(first, original, 'inspect must not mutate input state');
assert.equal(oneInspection.current.inspectionIds.length, 1);
const duplicateInspection = inspect(oneInspection, first.current.inspections[0], data);
assert.equal(duplicateInspection.current.inspectionIds.length, 1);
const twoInspections = inspect(oneInspection, first.current.inspections[1], data);
assert.equal(twoInspections.current.inspectionIds.length, MAX_INSPECTIONS);
assert.throws(() => inspect(twoInspections, first.current.inspections[2], data), /Inspection limit reached/);

const caseData = currentCase(first, data);
const correct = diagnose(first, caseData.diagnosisId, data);
assert.equal(correct.current.status, 'solved');
assert.equal(correct.solved, 1);
assert.equal(correct.score, 120);

const inspectedCorrect = diagnose(oneInspection, caseData.diagnosisId, data);
assert.equal(inspectedCorrect.score, 110);

const wrongChoices = first.current.diagnoses.filter((id) => id !== caseData.diagnosisId);
const oneWrong = diagnose(first, wrongChoices[0], data);
assert.equal(oneWrong.current.status, 'active');
assert.equal(oneWrong.current.guesses.length, 1);
const recovered = diagnose(oneWrong, caseData.diagnosisId, data);
assert.equal(recovered.current.status, 'solved');
assert.equal(recovered.score, 95);

const failed = diagnose(oneWrong, wrongChoices[1], data);
assert.equal(failed.current.status, 'failed');
assert.equal(failed.failed, 1);

let run = createRun({ code: 'WELD42' }, data);
for (let index = 0; index < RUN_ROUNDS; index += 1) {
  const activeCase = currentCase(run, data);
  run = diagnose(run, activeCase.diagnosisId, data);
  run = advanceCase(run, data);
}
assert.equal(run.status, 'complete');
assert.equal(run.solved, RUN_ROUNDS);
assert.equal(run.score, 720);
assert.equal(run.history.length, RUN_ROUNDS);
assert.equal(runGrade(run), 'Root Cause Master');

console.log('Root Cause deterministic engine tests passed.');
