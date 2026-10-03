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

function citationLooksTraceable(reference) {
  const value=String(reference||'').trim();
  if(value.length<24) return false;
  if(/https:\/\/|doi\s*[:.]|10\.\d{4,9}\//i.test(value)) return true;
  const hasYear=/(?:19|20)\d{2}/.test(value);
  const hasAuthority=/\b(et al\.?|journal|university|extension|usda|epa|fda|nih|nist|astm|iso|ncbi|pubmed|frontiers|hortscience|plant physiology|scientific reports|royal botanic|department|institute|society|proceedings|review|bmc|plos|nature|genome biology|genome research|new phytologist|scientia horticulturae|genetics|plant direct|academic press|industrial crops|horticulturae|applications in plant sciences|antioxidants|applied sciences|canadian journal|phytochemical analysis|biosystems engineering|agrophysics|acs)\b/i.test(value);
  return hasYear && hasAuthority;
}

function referenceTraceability(reference) {
  const authorityIds=authorityMatches(reference);
  if(authorityIds.length) return {traceable:true,authorityIds,kind:'central-authority'};
  const volumeSource=volumeSourceById.get(reference)||null;
  if(volumeSource?.location && /^https:\/\//.test(volumeSource.location)) {
    return {traceable:true,authorityIds:[],kind:'volume-register-external'};
  }
  if(citationLooksTraceable(reference)) return {traceable:true,authorityIds:[],kind:'bibliographic-citation'};
  return {traceable:false,authorityIds:[],kind:volumeSource?'volume-register-placeholder':'unresolved'};
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
  const trace=referenceTraceability(reference);
  const authorityIds = [...new Set(trace.authorityIds)].sort();
  const volumeSource = volumeSourceById.get(reference) || null;
  const status = authorityIds.length
    ? 'authoritative_registry_resolved_needs_claim_review'
    : volumeSource
      ? volumeSource.location && /^https:\/\//.test(volumeSource.location)
        ? 'volume_registry_resolved_needs_authority_review'
        : 'volume_registry_placeholder_needs_exact_source'
      : /^V\d{2}-SRC-\d{3}$/.test(reference)
        ? 'missing_volume_register_entry_needs_resolution'
        : trace.traceable
          ? 'citation_traceable_needs_authority_review'
          : 'citation_text_needs_resolution';
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
const lessonRows = lessons.map(lesson => {
  const refs=(lesson.sourceNotes||[]).map(sourceText).filter(Boolean);
  const traces=refs.map(referenceTraceability);
  const allCentral=refs.length>0 && traces.every(trace=>trace.authorityIds.length>0);
  const allTraceable=refs.length>0 && traces.every(trace=>trace.traceable);
  return {
    lessonId: lesson.id,
    number: Number(lesson.number),
    part: lesson.__part,
    canonicalFile: lesson.__path,
    sourceReferenceIds: refs.map(reference => referenceIdByRaw.get(reference)),
    traceableReferenceCount: traces.filter(trace=>trace.traceable).length,
    sourceReferenceCount: refs.length,
    resolutionState: allCentral
      ? 'authority_links_available_claim_review_pending'
      : allTraceable
        ? 'source_traceable_authority_review_pending'
        : 'source_resolution_incomplete'
  };
});

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
    citationTraceableNeedsAuthorityReview: countStatus('citation_traceable_needs_authority_review'),
    citationTextNeedsResolution: countStatus('citation_text_needs_resolution'),
    lessonsWithAllSourcesTraceable: lessonRows.filter(row => row.resolutionState !== 'source_resolution_incomplete').length,
    approved: 0
  },
  authoritativeSourceRegistry: relativePath(root, authorityPath),
  references,
  lessons: lessonRows
};

fs.writeFileSync(outPath, `${JSON.stringify(output, null, 2)}\n`);
console.log(`Encyclopedia source queue: ${lessonRows.length}/420 lessons · ${references.length} unique references · ${output.summary.authoritativeRegistryResolved} centrally resolved`);
console.log(`Wrote ${relativePath(root, outPath)}`);
