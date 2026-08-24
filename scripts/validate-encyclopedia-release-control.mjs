import { readFile } from 'node:fs/promises';

const manifestPath = process.argv[2] || process.env.ENCYCLOPEDIA_BATCH_FILE;
if (!manifestPath) throw new Error('Provide an encyclopedia batch manifest path.');

const manifest = JSON.parse(await readFile(manifestPath, 'utf8'));
if (!manifest.batch || !Array.isArray(manifest.lessonFiles) || !manifest.lessonFiles.length) {
  throw new Error(`Invalid encyclopedia batch manifest: ${manifestPath}`);
}

const reviewOnly = manifest.publicationAuthorized === false || manifest.status === 'blocked_external_review';
const records = [];
for (const file of manifest.lessonFiles) {
  const lesson = JSON.parse(await readFile(file, 'utf8'));
  const control = lesson.reviewControl || {};
  records.push({ id: lesson.id, file, publicationAuthorized: control.publicationAuthorized, externalReview: control.externalReview });
  if (!reviewOnly && control.publicationAuthorized === false) {
    throw new Error(`${lesson.id} is blocked from publication by reviewControl.publicationAuthorized=false`);
  }
}

if (reviewOnly) {
  const incorrectlyAuthorized = records.filter(x => x.publicationAuthorized !== false);
  if (incorrectlyAuthorized.length) {
    throw new Error(`Review-only manifest contains lessons not explicitly blocked: ${incorrectlyAuthorized.map(x=>x.id).join(', ')}`);
  }
  console.log(`REVIEW-ONLY PASS: ${manifest.batch}; ${records.length} lessons explicitly blocked from publication.`);
  process.exit(0);
}

console.log(`PUBLICATION-CONTROL PASS: ${manifest.batch}; ${records.length} lessons do not carry an explicit publication block.`);
