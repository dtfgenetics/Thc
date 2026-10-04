import { readFile } from 'node:fs/promises';

const manifestPath = process.argv[2] || process.env.ENCYCLOPEDIA_BATCH_FILE;
if (!manifestPath) throw new Error('Provide an encyclopedia batch manifest path.');

const manifest = JSON.parse(await readFile(manifestPath, 'utf8'));
if (!manifest.batch || !Array.isArray(manifest.lessonFiles) || !manifest.lessonFiles.length) {
  throw new Error(`Invalid encyclopedia batch manifest: ${manifestPath}`);
}

const reviewOnly = manifest.publicationAuthorized === false || manifest.status === 'blocked_external_review';
const ownerOverrideIds=new Set(Array.isArray(manifest.ownerOverrideLessonIds)?manifest.ownerOverrideLessonIds:[]);
if(ownerOverrideIds.size && manifest.ownerPublicationOverride!==true) throw new Error('Owner override lesson IDs require ownerPublicationOverride=true.');
const records = [];
for (const file of manifest.lessonFiles) {
  const lesson = JSON.parse(await readFile(file, 'utf8'));
  const control = lesson.reviewControl || {};
  const ownerOverride=ownerOverrideIds.has(lesson.id);
  records.push({ id: lesson.id, file, publicationAuthorized: control.publicationAuthorized, externalReview: control.externalReview, ownerOverride });
  if(ownerOverride){
    if(!String(control.releaseTimeReview||'').startsWith('completed_')) throw new Error(`${lesson.id}: owner publication override requires completed releaseTimeReview`);
    if(control.independentApproval===true) throw new Error(`${lesson.id}: owner override must not be used to represent independent approval`);
    if(control.safetyHold===true||lesson.safetyHold===true) throw new Error(`${lesson.id}: explicit safety hold cannot be owner-overridden by this manifest`);
  }
  if (!reviewOnly && control.publicationAuthorized === false && !ownerOverride) {
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

console.log(`PUBLICATION-CONTROL PASS: ${manifest.batch}; ${records.length} lessons publishable; ${records.filter(x=>x.ownerOverride).length} owner-authorized override(s); independent approval remains separate.`);
