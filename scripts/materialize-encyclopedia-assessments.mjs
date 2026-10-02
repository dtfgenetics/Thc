#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import { effectiveLessonAssessment } from './lib/encyclopedia-assessment-v2.mjs';

const root = process.cwd();
const encyclopediaRoot = path.join(root, 'content', 'encyclopedia');
const DRY_RUN = process.argv.includes('--dry-run');

const arr = value => Array.isArray(value) ? value.filter(Boolean) : [];
const rel = file => path.relative(root, file).replaceAll(path.sep, '/');
const readJson = file => JSON.parse(fs.readFileSync(file, 'utf8'));
const writeJson = (file, value) => fs.writeFileSync(file, `${JSON.stringify(value, null, 2)}\n`);

function hasStoredAssessment(lesson) {
  return arr(lesson.knowledgeCheck).length >= 3 || arr(lesson.assessment?.knowledgeCheck).length >= 3;
}

function materializeLesson(lesson) {
  if (hasStoredAssessment(lesson)) return false;
  const assessment = effectiveLessonAssessment(lesson);
  const prompts = arr(assessment.prompts).slice(0, 3);
  if (prompts.length < 3) throw new Error(`${lesson.id || lesson.number}: generated fewer than 3 prompts`);

  lesson.knowledgeCheck = prompts;
  lesson.assessmentDesign = {
    ...(lesson.assessmentDesign || {}),
    version: Number(assessment.version || 2),
    pattern: assessment.pattern || 'mechanism_or_workflow + misconception_challenge + applied_verification',
    scoringIntent: assessment.scoringIntent || 'Require lesson-specific evidence, not memorized universal targets.',
    materializedBy: 'scripts/materialize-encyclopedia-assessments.mjs',
    materializedAt: process.env.ENCYCLOPEDIA_BUILD_TIMESTAMP || 'source-controlled',
    reviewState: lesson.assessmentDesign?.reviewState || 'generated_draft_needs_independent_review',
    publicationEffect: lesson.assessmentDesign?.publicationEffect || 'none_review_state_unchanged'
  };
  return true;
}

const changed = [];
let inspected = 0;
let materialized = 0;

for (let part = 1; part <= 21; part += 1) {
  const volume = String(part).padStart(2, '0');
  const volumeRoot = path.join(encyclopediaRoot, `volume-${volume}`);
  const lessonRoot = path.join(volumeRoot, 'lessons');
  let foundIndividual = false;

  if (fs.existsSync(lessonRoot)) {
    for (const name of fs.readdirSync(lessonRoot).filter(file => /^thc-enc-\d{3}\.json$/.test(file)).sort()) {
      foundIndividual = true;
      const file = path.join(lessonRoot, name);
      const lesson = readJson(file);
      inspected += 1;
      if (!/^THC-ENC-\d{3,}$/.test(lesson.id || '')) continue;
      if (materializeLesson(lesson)) {
        materialized += 1;
        changed.push(rel(file));
        if (!DRY_RUN) writeJson(file, lesson);
      }
    }
  }

  if (foundIndividual || !fs.existsSync(volumeRoot)) continue;
  for (const name of fs.readdirSync(volumeRoot).filter(file => /^draft-lessons-\d+-\d+\.json$/.test(file)).sort()) {
    const file = path.join(volumeRoot, name);
    const pack = readJson(file);
    let packChanged = false;
    for (const lesson of arr(pack.lessons)) {
      inspected += 1;
      if (!/^THC-ENC-\d{3,}$/.test(lesson.id || '')) continue;
      if (materializeLesson(lesson)) {
        materialized += 1;
        packChanged = true;
      }
    }
    if (packChanged) {
      changed.push(rel(file));
      if (!DRY_RUN) writeJson(file, pack);
    }
  }
}

console.log(`Encyclopedia assessment materialization ${DRY_RUN ? 'dry run' : 'complete'}: ${materialized}/${inspected} lessons updated.`);
if (changed.length) console.log(`Changed ${changed.length} source file(s):\n${changed.map(file => ` - ${file}`).join('\n')}`);
