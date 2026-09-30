#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import { readCanonicalEncyclopediaLessons, readJson, relativePath } from './lib/encyclopedia-canonical-lessons.mjs';

const root = process.cwd();
const encyclopediaRoot = path.join(root, 'content', 'encyclopedia');
const outPath = path.join(root, 'data', 'encyclopedia-source-resolution-queue.json');
const authorityPath = path.join(encyclopediaRoot, 'evidence', 'authoritative-sources.json');
const authorityRegistry = readJson(authorityPath);
const authorities = authorityRegistry.sources || [];
const lessons = readCanonicalEncyclopediaLessons(root);
const normalize = value => String(value || '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
const sourceText = note => typeof note === 'string' ? note.trim() : String(note?.title || note?.id || note?.sourceId || '').trim();

const authorityByAlias = new Map();
for (const source of authorities) {
  authorityByAlias.set(source.id, source.id);
  for (const alias of source.aliases || []) authorityByAlias.set(alias, source.id);
}

const volumeSourceById = new Map();
for (let part = 1; part <= 21; part += 1) {
  const file = path.join(encyclopediaRoot, `volume-${String(part).padStart(2, '0')}`, 'source-register.json');
  if (!fs.existsSync(file)) continue;
  for (const source of readJson(file).sources || []) volumeSourceById.set(source.id, { ...source, registerFile: relativePath(root, file) });
}

function authorityMatches(reference) {
  const direct = authorityByAlias.get(reference);
  if (direct) return [direct];
  const normalizedReference = normalize(reference);
  return authorities.filter(source => {
    const tokens = [source.title, source.pmcid, source.doi, source.url].filter(Boolean).map(normalize).filter(token => token.length >= 8);
    return tokens.some(token => normalizedReference.includes(token) || token.includes(normalizedReference));
  }).map(source => source.id);
}

const usage = new Map();
for (const lesson of lessons) {
  for (const note of lesson.sourceNotes || []) {
    const reference = sourceText(note);
    if (!reference) continue;
    if (!usage.has(reference)) usage.set(reference, new Set());
    usage.get(reference).add(lesson.id);
  }
}

const references = [...usage.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([reference, lessonIds], index) => {
  const authorityIds = [...new Set(authorityMatches(reference))].sort();
  const volumeSource = volumeSourceById.get(reference) || null;
  const status = authorityIds.length
    ? 'authoritative_registry_resolved_needs_claim_review'
    : volumeSource
      ? volumeSource.location && /^https:\/\//.test(volumeSource.location)
        ? 'volume_registry_resolved_needs_authority_review'
        : 'volume_registry_placeholder_needs_exact_source'
      : /^V\d{2}-SRC-\d{3}$/.test(reference)
        ? 'missing_volume_register_entry_needs_resolution'
        : 'citation_text_needs_authority_review';
  return {
    referenceId: `ENC-SRC-CAND-${String(index + 1).padStart(4, '0')}`,
    rawReference: reference,
    lessonIds: [...lessonIds].sort(),
    useCount: lessonIds.size,
    resolvedAuthoritativeSourceIds: authorityIds,
    volumeRegistryRecord: volumeSource ? {
      id: volumeSource.id,
      title: volumeSource.title,
      location: volumeSource.location,
      useAndLimitation: volumeSource.useAndLimitation,
      registerFile: volumeSource.registerFile
    } : null,
    resolutionStatus: status,
    reviewState: 'pending_independent_source_and_claim_review',
    publicationEffect: 'none'
  };
});

const referenceIdByRaw = new Map(references.map(row => [row.rawReference, row.referenceId]));
const lessonRows = lessons.map(lesson => ({
  lessonId: lesson.id,
  number: Number(lesson.number),
  part: lesson.__part,
  canonicalFile: lesson.__path,
  sourceReferenceIds: (lesson.sourceNotes || []).map(sourceText).filter(Boolean).map(reference => referenceIdByRaw.get(reference)),
  resolutionState: (lesson.sourceNotes || []).map(sourceText).filter(Boolean).every(reference => authorityMatches(reference).length)
    ? 'authority_links_available_claim_review_pending'
    : 'source_resolution_incomplete'
}));

const countStatus = status => references.filter(row => row.resolutionStatus === status).length;
const output = {
  schemaVersion: '1.0.0',
  artifactId: 'thc-encyclopedia-source-resolution-queue',
  generatedBy: 'scripts/build-encyclopedia-source-resolution-queue.mjs',
  scope: 'All source-note references used by the 420 controlled THC-ENC lessons.',
  releaseRule: 'Resolution links are candidate evidence controls. They do not prove a lesson claim or authorize publication.',
  summary: {
    lessonCount: lessonRows.length,
    uniqueSourceReferences: references.length,
    authoritativeRegistryResolved: countStatus('authoritative_registry_resolved_needs_claim_review'),
    volumeRegistryResolved: countStatus('volume_registry_resolved_needs_authority_review'),
    volumeRegistryPlaceholders: countStatus('volume_registry_placeholder_needs_exact_source'),
    missingVolumeRegisterEntries: countStatus('missing_volume_register_entry_needs_resolution'),
    citationTextNeedsAuthorityReview: countStatus('citation_text_needs_authority_review'),
    approved: 0
  },
  authoritativeSourceRegistry: relativePath(root, authorityPath),
  references,
  lessons: lessonRows
};

fs.writeFileSync(outPath, `${JSON.stringify(output, null, 2)}\n`);
console.log(`Encyclopedia source queue: ${lessonRows.length}/420 lessons · ${references.length} unique references · ${output.summary.authoritativeRegistryResolved} centrally resolved`);
console.log(`Wrote ${relativePath(root, outPath)}`);
