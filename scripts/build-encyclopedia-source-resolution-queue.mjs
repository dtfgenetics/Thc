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
  if(/\b(?:19|20)\d{2}\b/.test(value) && /\b(et al\.?|journal|university|extension|usda|epa|fda|nih|nist|astm|iso|fao|ncbi|pubmed|frontiers|hortscience|plant physiology|scientific reports|royal botanic|department|institute|society|proceedings|review|bmc|plos|nature|genome biology|genome research|new phytologist|scientia horticulturae|genetics|plant direct|academic press|industrial crops|horticulturae|applications in plant sciences|antioxidants|applied sciences|canadian journal|phytochemical analysis|biosystems engineering|agrophysics|acs|wiley|springer|elsevier|agricultural|photosynthesis|technology|methods)\b/i.test(value)) return true;
  if(/\b\d+\s+U\.S\.C\.\s*§|\bUnited States Code\b|\bU\.S\. Geological Survey\b|\bUSGS\b/i.test(value)) return true;
  const institutional=/\b(university|extension|cooperative extension|food inspection agency|apogee instruments|fluke corporation|royal botanic gardens|kew|geological survey|usgs|usda|epa|fda|nih|nist|osha|fao|government|department|institutes?|society|ncbi|international union)\b/i.test(value);
  if(institutional && /[.:]/.test(value) && value.length>=32) return true;
  const hasYear=/\b(?:19|20)\d{2}\b/.test(value);
  const citationPunctuation=/\((?:19|20)\d{2}\)|\b(?:19|20)\d{2}\s*[;.:]/.test(value);
  if(hasYear && citationPunctuation && !isControlOrContextNote(value,null)) return true;
  return false;
}

function isControlOrContextNote(reference, volumeSource=null) {
  const value=String(reference||'').trim();
  if(!value) return false;
  if(/^(?:The )?controlled\b|^Transfer note:|^No source is used\b|^Public wording\b|^Area-normalized\b|^Because the study\b|^The same study\b|^The study and cited\b|^Visible swelling\b|^The 12\/12 schedule\b|^No fixed\b|^Exact .* not presented\b|^Deposition .* not treated\b|^The practical .* framework\b|^Boundary-layer\b|^Cannabis .* literature\b|^Cannabis .* source registers\b|^Cannabis-specific .* studies\b|^Direct medical-cannabis\b|^General \b|^Peer-reviewed \b|^Recent \b|^Validated \b|^Public documentation\b|^No standardized \b|^THC-ENC-\d{3}\b/i.test(value)) return true;
  if(/^THC(?:\s*-\s*Teaching Healthy Cultivation|\s+Cultivation)?\b.*(?:Source Packet|Source Materials Packet)/i.test(value)) return true;
  if(/^V\d{2}-SRC-\d{3}\b/i.test(value) && /project (?:control|pathology|sanitation)|THC Cannabis .* Source Packet/i.test(value)) return true;
  if(volumeSource) {
    const location=String(volumeSource.location||'');
    const title=String(volumeSource.title||'');
    if(!/^https:\/\//.test(location) && /\b(THC|Volumes?|Current|controlled|project|source registers?)\b/i.test(title)) return true;
  }
  return false;
}

function referenceTraceability(reference) {
  const authorityIds=authorityMatches(reference);
  if(authorityIds.length) return {traceable:true,traceabilityRequired:true,authorityIds,kind:'central-authority'};
  const volumeSource=volumeSourceById.get(reference)||null;
  if(volumeSource?.location && /^https:\/\//.test(volumeSource.location)) {
    return {traceable:true,traceabilityRequired:true,authorityIds:[],kind:'volume-register-external'};
  }
  if(isControlOrContextNote(reference,volumeSource)) {
    return {traceable:false,traceabilityRequired:false,authorityIds:[],kind:'control-context-note'};
  }
  if(citationLooksTraceable(reference)) return {traceable:true,traceabilityRequired:true,authorityIds:[],kind:'bibliographic-citation'};
  return {traceable:false,traceabilityRequired:true,authorityIds:[],kind:volumeSource?'volume-register-placeholder':'unresolved'};
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
  let status;
  if(!trace.traceabilityRequired) status='control_note_resolved_not_evidence_source';
  else if(authorityIds.length) status='authoritative_registry_resolved_needs_claim_review';
  else if(volumeSource?.location && /^https:\/\//.test(volumeSource.location)) status='volume_registry_resolved_needs_authority_review';
  else if(/^V\d{2}-SRC-\d{3}$/.test(reference) && !volumeSource) status='missing_volume_register_entry_needs_resolution';
  else if(trace.traceable) status='citation_traceable_needs_authority_review';
  else if(volumeSource) status='volume_registry_placeholder_needs_exact_source';
  else status='citation_text_needs_resolution';
  return {
    referenceId: `ENC-SRC-CAND-${String(index + 1).padStart(4, '0')}`,
    rawReference: reference,
    lessonIds: [...lessonIds].sort(),
    useCount: lessonIds.size,
    referenceKind: trace.kind,
    traceabilityRequired: trace.traceabilityRequired,
    traceable: trace.traceable,
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
  const evidenceTraces=traces.filter(trace=>trace.traceabilityRequired);
  const traceableEvidenceCount=evidenceTraces.filter(trace=>trace.traceable).length;
  const unresolvedEvidenceCount=evidenceTraces.filter(trace=>!trace.traceable).length;
  const controlContextCount=traces.filter(trace=>!trace.traceabilityRequired).length;
  const enoughEvidence=evidenceTraces.length>=2;
  const allCentral=enoughEvidence && evidenceTraces.every(trace=>trace.authorityIds.length>0);
  const allTraceable=enoughEvidence && unresolvedEvidenceCount===0;
  return {
    lessonId: lesson.id,
    number: Number(lesson.number),
    part: lesson.__part,
    canonicalFile: lesson.__path,
    sourceReferenceIds: refs.map(reference => referenceIdByRaw.get(reference)),
    sourceReferenceCount: refs.length,
    evidenceReferenceCount: evidenceTraces.length,
    traceableReferenceCount: traceableEvidenceCount,
    unresolvedEvidenceReferenceCount: unresolvedEvidenceCount,
    controlContextNoteCount: controlContextCount,
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
    controlNotesExcludedFromEvidenceTraceability: countStatus('control_note_resolved_not_evidence_source'),
    lessonsWithAllSourcesTraceable: lessonRows.filter(row => row.resolutionState !== 'source_resolution_incomplete').length,
    lessonsNeedingSourceResolution: lessonRows.filter(row => row.resolutionState === 'source_resolution_incomplete').length,
    approved: 0
  },
  authoritativeSourceRegistry: relativePath(root, authorityPath),
  references,
  lessons: lessonRows
};

fs.writeFileSync(outPath, `${JSON.stringify(output, null, 2)}\n`);
console.log(`Encyclopedia source queue: ${lessonRows.length}/420 lessons · ${references.length} unique references · ${output.summary.authoritativeRegistryResolved} centrally resolved`);
console.log(`Wrote ${relativePath(root, outPath)}`);
