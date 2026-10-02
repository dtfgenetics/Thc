#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import { readCanonicalEncyclopediaLessons } from './lib/encyclopedia-canonical-lessons.mjs';

const root = process.cwd();
const DRY_RUN = process.argv.includes('--dry-run');
const rel = file => path.relative(root, file).replaceAll(path.sep, '/');
const readJson = file => JSON.parse(fs.readFileSync(file, 'utf8'));
const writeJson = (file, value) => fs.writeFileSync(file, `${JSON.stringify(value, null, 2)}\n`);
const generatedAt = process.env.ENCYCLOPEDIA_BUILD_TIMESTAMP || 'source-controlled';

function needsReleaseControl(lesson) {
  return !lesson.reviewControl && !lesson.revision;
}

function materializeReleaseControl(lesson) {
  if (!needsReleaseControl(lesson)) return false;
  if (lesson.publicationAuthorized === undefined || lesson.publicationAuthorized === null) {
    lesson.publicationAuthorized = false;
  }
  lesson.reviewControl = {
    controlledManuscript: 'THC Cannabis Encyclopedia canonical 420 source set',
    evidenceControl: 'claim_level_evidence_migration_pending',
    secondaryEvidenceReview: 'pending',
    externalReview: 'pending',
    externalReviewType: 'plant_science_and_cultivation_reference',
    publicationAuthorized: false,
    independentApproval: false,
    websiteAction: 'hold_from_publication',
    releaseGateReason: [
      'claim_level_evidence_migration_pending',
      'approved_teaching_visual_pending',
      'assessment_rationale_independent_review_pending',
      'visitor_facing_release_verification_pending'
    ],
    materializedBy: 'scripts/materialize-encyclopedia-release-controls.mjs',
    materializedAt: generatedAt
  };
  return true;
}

const changedFiles = new Map();
let updated = 0;

for (const lessonRef of readCanonicalEncyclopediaLessons(root)) {
  const file = path.join(root, lessonRef.__path);
  const json = changedFiles.get(file) || readJson(file);
  const lessons = Array.isArray(json.lessons) ? json.lessons : [json];
  const lesson = lessons.find(row => row.id === lessonRef.id);
  if (!lesson) continue;
  if (materializeReleaseControl(lesson)) {
    updated += 1;
    changedFiles.set(file, json);
  }
}

if (!DRY_RUN) {
  for (const [file, json] of changedFiles) writeJson(file, json);
}

console.log(`Encyclopedia release-control materialization ${DRY_RUN ? 'dry run' : 'complete'}: ${updated} lesson control record(s).`);
if (changedFiles.size) console.log(`Changed ${changedFiles.size} source file(s):\n${[...changedFiles.keys()].map(file => ` - ${rel(file)}`).join('\n')}`);
