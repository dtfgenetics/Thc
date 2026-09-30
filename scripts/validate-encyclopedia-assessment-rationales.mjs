#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import { readCanonicalEncyclopediaLessons } from './lib/encyclopedia-canonical-lessons.mjs';

const root = process.cwd();
const artifactPath = path.join(root, 'data', 'encyclopedia-assessment-rationale-package.json');
const errors = [];
if (!fs.existsSync(artifactPath)) errors.push('Assessment rationale package is missing.');
const artifact = errors.length ? { lessons: [] } : JSON.parse(fs.readFileSync(artifactPath, 'utf8'));
const canonical = readCanonicalEncyclopediaLessons(root);
const canonicalById = new Map(canonical.map(lesson => [lesson.id, lesson]));
const rows = Array.isArray(artifact.lessons) ? artifact.lessons : [];

if (rows.length !== 420) errors.push(`Expected 420 lesson rationale records; found ${rows.length}.`);
if (new Set(rows.map(row => row.lessonId)).size !== rows.length) errors.push('Lesson rationale records must have unique lesson IDs.');
for (const row of rows) {
  if (!canonicalById.has(row.lessonId)) errors.push(`${row.lessonId}: no canonical lesson.`);
  if (!Array.isArray(row.prompts) || row.prompts.length !== 3) errors.push(`${row.lessonId}: expected exactly 3 prompts.`);
  if (!Array.isArray(row.rationales) || row.rationales.length !== 3) errors.push(`${row.lessonId}: expected exactly 3 rationales.`);
  if (row.learnerFacing !== false) errors.push(`${row.lessonId}: draft rationales must not be learner-facing.`);
  if (!/pending|needs/i.test(String(row.reviewState))) errors.push(`${row.lessonId}: rationale review must remain pending.`);
  if (/approved/i.test(String(row.reviewState))) errors.push(`${row.lessonId}: draft rationale cannot be approved.`);
  if (!Array.isArray(row.sourceAnchors) || row.sourceAnchors.length < 2) errors.push(`${row.lessonId}: needs at least 2 source anchors.`);
  if (!Array.isArray(row.evidenceLimits) || row.evidenceLimits.length < 1) errors.push(`${row.lessonId}: evidence limits are missing.`);
  for (const [index, rationale] of (row.rationales || []).entries()) {
    if (rationale.questionId !== `${row.lessonId}-Q${index + 1}`) errors.push(`${row.lessonId}: rationale question ID mismatch.`);
    if (!Array.isArray(rationale.expectedReasoning) || rationale.expectedReasoning.length < 4) errors.push(`${row.lessonId}-Q${index + 1}: rationale is incomplete.`);
  }
}
for (const lesson of canonical) if (!rows.some(row => row.lessonId === lesson.id)) errors.push(`${lesson.id}: missing rationale record.`);

if (errors.length) {
  console.error(`Encyclopedia assessment rationale validation failed with ${errors.length} error(s):`);
  errors.slice(0, 80).forEach(error => console.error(` - ${error}`));
  process.exit(1);
}
console.log('Encyclopedia assessment rationales PASS: 420/420 lessons have three materialized draft rationales; all remain non-public and pending independent review.');
