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
const duplicateGroups = Array.isArray(queue.duplicateGroups) ? queue.duplicateGroups : [];
const lessonRows = Array.isArray(queue.lessons) ? queue.lessons : [];
const referenceByRaw = new Map(references.map(row => [row.rawReference, row]));
const referenceById = new Map(references.map(row => [row.referenceId, row]));

if (lessonRows.length !== 420) errors.push(`Expected 420 lesson source rows; found ${lessonRows.length}.`);
if (new Set(lessonRows.map(row => row.lessonId)).size !== lessonRows.length) errors.push('Lesson source rows must have unique lesson IDs.');
if (new Set(references.map(row => row.referenceId)).size !== references.length) errors.push('Source candidate IDs must be unique.');
if (new Set(duplicateGroups.map(row => row.duplicateGroupId)).size !== duplicateGroups.length) errors.push('Duplicate-group IDs must be unique.');
for (const lesson of canonical) {
  const row = lessonRows.find(candidate => candidate.lessonId === lesson.id);
  if (!row) { errors.push(`${lesson.id}: missing lesson source row.`); continue; }
  const notes = (lesson.sourceNotes || []).map(note => typeof note === 'string' ? note.trim() : String(note?.title || note?.id || note?.sourceId || '').trim()).filter(Boolean);
  if (row.sourceReferenceIds.length !== notes.length) errors.push(`${lesson.id}: source reference count mismatch.`);
  if (Number(row.sourceReferenceCount || 0) !== notes.length) errors.push(`${lesson.id}: sourceReferenceCount mismatch.`);
  if (Number(row.evidenceReferenceCount || 0) + Number(row.controlContextNoteCount || 0) !== notes.length) errors.push(`${lesson.id}: evidence/control source accounting mismatch.`);
  if (Number(row.traceableReferenceCount || 0) > Number(row.evidenceReferenceCount || 0)) errors.push(`${lesson.id}: traceable evidence count exceeds evidence references.`);
  if (Number(row.unresolvedEvidenceReferenceCount || 0) > Number(row.evidenceReferenceCount || 0)) errors.push(`${lesson.id}: unresolved evidence count exceeds evidence references.`);
  const evidenceCount=Number(row.evidenceReferenceCount || 0);
  const expectedDiversity=evidenceCount>=2
    ? 'multi_source_set'
    : evidenceCount===1
      ? 'single_source_traceable_review_needed'
      : 'no_evidence_source_reference';
  if(row.sourceDiversityState!==expectedDiversity) errors.push(`${lesson.id}: sourceDiversityState mismatch; expected ${expectedDiversity}, found ${row.sourceDiversityState||'(missing)'}.`);
  if (row.resolutionState !== 'source_resolution_incomplete') {
    if (evidenceCount < 1) errors.push(`${lesson.id}: resolved source state requires at least one traceable evidence reference.`);
    if (Number(row.unresolvedEvidenceReferenceCount || 0) !== 0) errors.push(`${lesson.id}: resolved source state cannot retain unresolved evidence references.`);
  }
  for (const refId of row.sourceReferenceIds || []) if (!referenceById.has(refId)) errors.push(`${lesson.id}: unknown source reference id ${refId}.`);
  for (const note of notes) if (!referenceByRaw.has(note)) errors.push(`${lesson.id}: source note absent from queue: ${note.slice(0, 80)}`);
}
const lateVolumeMissing = references.filter(reference => /^V(?:20|21)-SRC-\d{3}$/.test(String(reference.rawReference)) && reference.resolutionStatus === 'missing_volume_register_entry_needs_resolution');
if (lateVolumeMissing.length) errors.push(`Volume 20–21 source-register regression: ${lateVolumeMissing.length} reference(s) are missing controlled register entries.`);
if (Number(queue.summary?.missingVolumeRegisterEntries || 0) !== references.filter(reference => reference.resolutionStatus === 'missing_volume_register_entry_needs_resolution').length) errors.push('Source queue summary missingVolumeRegisterEntries is stale.');
if (Number(queue.summary?.directLocatorResolvedNeedsAuthorityReview || 0) !== references.filter(reference => reference.resolutionStatus === 'direct_locator_resolved_needs_authority_review').length) errors.push('Source queue summary direct-locator count is stale.');
if (Number(queue.summary?.controlNotesExcludedFromEvidenceTraceability || 0) !== references.filter(reference => reference.resolutionStatus === 'control_note_resolved_not_evidence_source').length) errors.push('Source queue summary control-note count is stale.');
if (Number(queue.summary?.lessonsWithAllSourcesTraceable || 0) !== lessonRows.filter(row => row.resolutionState !== 'source_resolution_incomplete').length) errors.push('Source queue summary traceable lesson count is stale.');
if (Number(queue.summary?.lessonsNeedingSourceResolution || 0) !== lessonRows.filter(row => row.resolutionState === 'source_resolution_incomplete').length) errors.push('Source queue summary unresolved lesson count is stale.');
if (Number(queue.summary?.duplicateIdentityGroups || 0) !== duplicateGroups.length) errors.push('Source queue summary duplicateIdentityGroups is stale.');
if (Number(queue.summary?.referencesInDuplicateGroups || 0) !== references.filter(row => Array.isArray(row.duplicateGroupIds) && row.duplicateGroupIds.length).length) errors.push('Source queue summary referencesInDuplicateGroups is stale.');

const refIds=new Set(references.map(row=>row.referenceId));
for(const group of duplicateGroups){
  if(!/^ENC-SRC-DUP-\d{4}$/.test(group.duplicateGroupId||'')) errors.push(`Invalid duplicateGroupId ${group.duplicateGroupId||'(missing)'}`);
  if(!/^(doi|pmc|pmid|url):/.test(String(group.identityKey||''))) errors.push(`${group.duplicateGroupId}: invalid identityKey`);
  if(!Array.isArray(group.referenceIds)||group.referenceIds.length<2) errors.push(`${group.duplicateGroupId}: duplicate group must contain at least 2 references`);
  for(const id of group.referenceIds||[]) if(!refIds.has(id)) errors.push(`${group.duplicateGroupId}: unknown reference ${id}`);
}

for (const reference of references) {
  if (!Array.isArray(reference.lessonIds) || !reference.lessonIds.length) errors.push(`${reference.referenceId}: no lesson usage.`);
  if (typeof reference.traceabilityRequired !== 'boolean') errors.push(`${reference.referenceId}: traceabilityRequired must be boolean.`);
  if (typeof reference.traceable !== 'boolean') errors.push(`${reference.referenceId}: traceable must be boolean.`);
  if (!reference.traceabilityRequired && reference.resolutionStatus !== 'control_note_resolved_not_evidence_source') errors.push(`${reference.referenceId}: non-evidence note must use control-note resolution status.`);
  if (!reference.traceabilityRequired && reference.traceable) errors.push(`${reference.referenceId}: control/context notes must not be counted as traceable evidence.`);
  if (!/pending|needs|incomplete|resolved/.test(String(reference.resolutionStatus))) errors.push(`${reference.referenceId}: invalid resolution status.`);
  if (!/pending/.test(String(reference.reviewState))) errors.push(`${reference.referenceId}: review must remain pending.`);
  if (reference.publicationEffect !== 'none') errors.push(`${reference.referenceId}: publication effect must be none.`);
  const identityKeys = Array.isArray(reference.sourceIdentityKeys) ? reference.sourceIdentityKeys : [];
  if(new Set(identityKeys).size!==identityKeys.length) errors.push(`${reference.referenceId}: sourceIdentityKeys must be unique.`);
  for(const key of identityKeys) if(!/^(doi|pmc|pmid|url):/.test(String(key))) errors.push(`${reference.referenceId}: invalid source identity key ${key}`);
  const directLocators = Array.isArray(reference.directLocators) ? reference.directLocators : [];
  if (new Set(directLocators).size !== directLocators.length) errors.push(`${reference.referenceId}: directLocators must be unique.`);
  for (const locator of directLocators) if (!/^https:\/\//.test(String(locator))) errors.push(`${reference.referenceId}: direct locator must use HTTPS: ${locator}`);
  if (reference.resolutionStatus === 'direct_locator_resolved_needs_authority_review' && !directLocators.length) errors.push(`${reference.referenceId}: direct-locator status requires at least one locator.`);
  for (const id of reference.resolvedAuthoritativeSourceIds || []) if (!authorityIds.has(id)) errors.push(`${reference.referenceId}: unknown authority ${id}.`);
}

if (errors.length) {
  console.error(`Encyclopedia source queue validation failed with ${errors.length} error(s):`);
  errors.slice(0, 80).forEach(error => console.error(` - ${error}`));
  process.exit(1);
}
console.log(`Encyclopedia source queue PASS: 420/420 lessons and ${references.length} unique source references are tracked without changing review or publication state.`);
