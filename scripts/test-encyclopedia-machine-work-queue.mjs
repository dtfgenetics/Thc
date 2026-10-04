#!/usr/bin/env node
import fs from 'node:fs';

const fail = message => {
  console.error('FAIL: ' + message);
  process.exitCode = 1;
};

const file = 'data/encyclopedia-machine-work-queue.json';
if (!fs.existsSync(file)) {
  fail('missing ' + file);
  process.exit();
}

const data = JSON.parse(fs.readFileSync(file, 'utf8'));
const machine = Array.isArray(data.machineProductionQueue) ? data.machineProductionQueue : [];
const review = Array.isArray(data.reviewQueue) ? data.reviewQueue : [];
const blocked = Array.isArray(data.externalHumanQueue) ? data.externalHumanQueue : [];

if (data.schemaVersion !== '1.0.0') fail('unexpected schemaVersion');
if (Number(data.summary?.lessonCount) !== 420) fail('expected 420 lessons in summary');

const allowedMachineActions = new Set([
  'repair_lesson_content_contract',
  'map_atomic_claim_evidence',
  'resolve_source_authority_and_exact_locator',
  'produce_teaching_visual_candidate'
]);

for (const row of machine) {
  if (!row.lessonId) fail('machine queue row missing lessonId');
  if (!Array.isArray(row.actions) || row.actions.length === 0) fail(row.lessonId + ': machine row has no actions');
  for (const action of row.actions) {
    if (!allowedMachineActions.has(action)) {
      fail(row.lessonId + ': human/release action leaked into machine queue: ' + action);
    }
  }
}

const machineIds = new Set(machine.map(x => x.lessonId));
for (const row of review) {
  if (machineIds.has(row.lessonId) && row.machineWorkComplete === true) {
    fail(row.lessonId + ': review row marked machineWorkComplete but also present in machine queue');
  }
}

for (const row of blocked) {
  if (!Array.isArray(row.gates) || row.gates.length === 0) fail((row.lessonId || 'row') + ': external-human row missing gates');
}

const counts = data.summary || {};
if (Number(counts.machineProduction) !== machine.length) fail('machineProduction summary mismatch');
if (Number(counts.reviewPending) !== review.length) fail('reviewPending summary mismatch');
if (Number(counts.externalHuman) !== blocked.length) fail('externalHuman summary mismatch');

if (!process.exitCode) {
  console.log('Encyclopedia machine work queue PASS: ' +
    machine.length + ' machine-production rows; ' +
    review.length + ' review rows; ' +
    blocked.length + ' external-human rows.');
}
