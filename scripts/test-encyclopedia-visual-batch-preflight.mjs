import assert from 'node:assert/strict';
import { validateVisualProductionQueue } from './lib/encyclopedia-visual-batch-preflight.mjs';
const source = () => ({ summary: { visualTasksNeeded: 1 }, items: [
  { lessonId: 'THC-ENC-420', visualRoles: [
    { role: 'overview', ordinal: 1, status: 'brief_ready_raster_artwork_needed' },
    { role: 'structure', ordinal: 2, status: 'raster_artwork_produced_review_pending' }
  ]}
]});
assert.equal(validateVisualProductionQueue(source()), 1);
const duplicate = source();
duplicate.items[0].visualRoles.push({ role: 'overview', ordinal: 3, status: 'brief_ready_raster_artwork_needed' });
assert.throws(() => validateVisualProductionQueue(duplicate), /Duplicate teaching visual task/);
const mismatch = source(); mismatch.summary.visualTasksNeeded = 2;
assert.throws(() => validateVisualProductionQueue(mismatch), /task count mismatch/);
const malformed = source(); malformed.items[0].visualRoles[0].ordinal = 0;
assert.throws(() => validateVisualProductionQueue(malformed), /Invalid teaching visual role/);
assert.throws(() => validateVisualProductionQueue({}), /Invalid visual production queue/);
const duplicateLesson = source(); duplicateLesson.items.push(structuredClone(duplicateLesson.items[0])); duplicateLesson.summary.visualTasksNeeded = 2;
assert.throws(() => validateVisualProductionQueue(duplicateLesson), /Duplicate visual queue lesson/);
const duplicateOrdinal = source(); duplicateOrdinal.items[0].visualRoles[1].ordinal = 1;
assert.throws(() => validateVisualProductionQueue(duplicateOrdinal), /Duplicate teaching visual ordinal/);
const invalidStatus = source(); invalidStatus.items[0].visualRoles[0].status = 'approved';
assert.throws(() => validateVisualProductionQueue(invalidStatus), /Unknown teaching visual status/);
console.log('Visual production batch preflight tests passed');
