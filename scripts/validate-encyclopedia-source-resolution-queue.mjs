#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import { readCanonicalEncyclopediaLessons, readJson } from './lib/encyclopedia-canonical-lessons.mjs';

const root = process.cwd();
const queuePath = path.join(root, 'data', 'encyclopedia-source-resolution-queue.json');
const authorityPath = path.join(root, 'content', 'encyclopedia', 'evidence', 'authoritative-sources.json');
const errors = [];
if (!fs.existsSync(queuePath)) errors.push('Source resolution queue is missing.');
const queue = errors.length ? { references: [], lessons: [] } : readJson(queuePath);
const canonical = readCanonicalEncyclopediaLessons(root);
const authorityIds = new Set((readJson(authorityPath).sources || []).map(source => source.id));
const references = Array.isArray(queue.references) ? queue.references : [];
const lessonRows = Array.isArray(queue.lessons) ? queue.lessons : [];
const referenceByRaw = new Map(references.map(row => [row.rawReference, row]));

if (lessonRows.length !== 420) errors.push(`Expected 420 lesson source rows; found ${lessonRows.length}.`);
if (new Set(lessonRows.map(row => row.lessonId)).size !== lessonRows.length) errors.push('Lesson source rows must have unique lesson IDs.');
if (new Set(references.map(row => row.referenceId)).size !== references.length) errors.push('Source candidate IDs must be unique.');
for (const lesson of canonical) {
  const row = lessonRows.find(candidate => candidate.lessonId === lesson.id);
  if (!row) { errors.push(`${lesson.id}: missing lesson source row.`); continue; }
  const notes = (lesson.sourceNotes || []).map(note => typeof note === 'string' ? note.trim() : String(note?.title || note?.id || note?.sourceId || '').trim()).filter(Boolean);
  if (row.sourceReferenceIds.length !== notes.length) errors.push(`${lesson.id}: source reference count mismatch.`);
  for (const note of notes) if (!referenceByRaw.has(note)) errors.push(`${lesson.id}: source note absent from queue: ${note.slice(0, 80)}`);
}
const lateVolumeMissing = references.filter(reference => /^V(?:20|21)-SRC-\d{3}$/.test(String(reference.rawReference)) && reference.resolutionStatus === 'missing_volume_register_entry_needs_resolution');
if (lateVolumeMissing.length) errors.push(`Volume 20–21 source-register regression: ${lateVolumeMissing.length} reference(s) are missing controlled register entries.`);
if (Number(queue.summary?.missingVolumeRegisterEntries || 0) !== references.filter(reference => reference.resolutionStatus === 'missing_volume_register_entry_needs_resolution').length) errors.push('Source queue summary missingVolumeRegisterEntries is stale.');

for (const reference of references) {
  if (!Array.isArray(reference.lessonIds) || !reference.lessonIds.length) errors.push(`${reference.referenceId}: no lesson usage.`);
  if (!/pending|needs|incomplete|resolved/.test(String(reference.resolutionStatus))) errors.push(`${reference.referenceId}: invalid resolution status.`);
  if (!/pending/.test(String(reference.reviewState))) errors.push(`${reference.referenceId}: review must remain pending.`);
  if (reference.publicationEffect !== 'none') errors.push(`${reference.referenceId}: publication effect must be none.`);
  for (const id of reference.resolvedAuthoritativeSourceIds || []) if (!authorityIds.has(id)) errors.push(`${reference.referenceId}: unknown authority ${id}.`);
}

if (errors.length) {
  console.error(`Encyclopedia source queue validation failed with ${errors.length} error(s):`);
  errors.slice(0, 80).forEach(error => console.error(` - ${error}`));
  process.exit(1);
}
console.log(`Encyclopedia source queue PASS: 420/420 lessons and ${references.length} unique source references are tracked without changing review or publication state.`);
