import { readFile } from 'node:fs/promises';

const manifestPath = process.argv[2] || 'configuration/encyclopedia-backfill-191-280.json';
const manifest = JSON.parse(await readFile(manifestPath, 'utf8'));

if (manifest?.schemaVersion !== 1) throw new Error('Backfill manifest must use schemaVersion 1.');
if (!Array.isArray(manifest.batches) || manifest.batches.length === 0) throw new Error('Backfill manifest has no batches.');
if (new Set(manifest.batches).size !== manifest.batches.length) throw new Error('Backfill manifest contains duplicate batch paths.');

const expectedStart = Number(String(manifest.expectedStartId || '').match(/^THC-ENC-(\d{3})$/)?.[1]);
const expectedEnd = Number(String(manifest.expectedEndId || '').match(/^THC-ENC-(\d{3})$/)?.[1]);
if (!Number.isInteger(expectedStart) || !Number.isInteger(expectedEnd) || expectedEnd < expectedStart) {
  throw new Error('Backfill expectedStartId/expectedEndId are invalid.');
}

const seenBatchNames = new Set();
const seenIds = new Set();
const batches = [];
let expected = expectedStart;

for (const batchPath of manifest.batches) {
  const batch = JSON.parse(await readFile(batchPath, 'utf8'));
  if (!batch?.batch || seenBatchNames.has(batch.batch)) throw new Error(`Invalid or duplicate batch name in ${batchPath}.`);
  seenBatchNames.add(batch.batch);
  if (batch.publicationAuthorized !== true) throw new Error(`${batch.batch} is not explicitly publicationAuthorized=true.`);
  if (batch.status === 'blocked_external_review') throw new Error(`${batch.batch} is blocked from publication.`);
  if (!Array.isArray(batch.lessonFiles) || batch.lessonFiles.length === 0) throw new Error(`${batch.batch} has no lessonFiles.`);

  const ids = [];
  for (const lessonPath of batch.lessonFiles) {
    const lesson = JSON.parse(await readFile(lessonPath, 'utf8'));
    const match = String(lesson?.id || '').match(/^THC-ENC-(\d{3})$/);
    if (!match) throw new Error(`Invalid lesson ID in ${lessonPath}.`);
    const number = Number(match[1]);
    if (number !== expected) {
      throw new Error(`Backfill continuity failure at ${lesson.id}: expected THC-ENC-${String(expected).padStart(3, '0')}.`);
    }
    if (seenIds.has(lesson.id)) throw new Error(`Duplicate lesson ID ${lesson.id}.`);
    if (!lesson.title || !lesson.objective || !Array.isArray(lesson.coreScience) || lesson.coreScience.length < 2) {
      throw new Error(`Incomplete canonical lesson ${lesson.id}.`);
    }
    if (!Array.isArray(lesson.sourceNotes) || lesson.sourceNotes.length === 0) throw new Error(`${lesson.id} has no sourceNotes.`);
    if (lesson.reviewControl?.publicationAuthorized === false) throw new Error(`${lesson.id} is blocked by lesson reviewControl.`);
    seenIds.add(lesson.id);
    ids.push(lesson.id);
    expected += 1;
  }
  batches.push({ path: batchPath, batch: batch.batch, ids });
}

if (expected - 1 !== expectedEnd) {
  throw new Error(`Backfill ended at THC-ENC-${String(expected - 1).padStart(3, '0')}; expected ${manifest.expectedEndId}.`);
}

const sentinels = Array.isArray(manifest.publicSentinels) ? manifest.publicSentinels : [];
for (const id of sentinels) {
  if (!seenIds.has(id)) throw new Error(`Public sentinel ${id} is outside the validated backfill.`);
}

console.log(JSON.stringify({
  ok: true,
  manifest: manifest.id,
  batchCount: batches.length,
  lessonCount: seenIds.size,
  range: [manifest.expectedStartId, manifest.expectedEndId],
  batches: batches.map(({ batch, ids }) => ({ batch, first: ids[0], last: ids.at(-1), count: ids.length }))
}, null, 2));
