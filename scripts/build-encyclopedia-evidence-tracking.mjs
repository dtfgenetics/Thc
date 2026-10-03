#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const encRoot = path.join(root, 'content', 'encyclopedia');
const evidenceRoot = path.join(encRoot, 'evidence');
const outPath = path.join(root, 'data', 'encyclopedia-evidence-tracking.json');

const readJson = file => JSON.parse(fs.readFileSync(file, 'utf8'));
const rel = file => path.relative(root, file).replaceAll(path.sep, '/');
const arr = value => Array.isArray(value) ? value : [];
const norm = value => String(value ?? '').trim();
const lessonId = number => `THC-ENC-${String(number).padStart(3, '0')}`;

function readCanonicalLessons() {
  const lessons = [];
  for (let volumeNumber = 1; volumeNumber <= 21; volumeNumber += 1) {
    const volume = String(volumeNumber).padStart(2, '0');
    const volumeDir = path.join(encRoot, `volume-${volume}`);
    const lessonsDir = path.join(volumeDir, 'lessons');
    let foundIndividual = false;

    if (fs.existsSync(lessonsDir)) {
      for (const name of fs.readdirSync(lessonsDir).filter(file => /^thc-enc-\d{3}\.json$/.test(file)).sort()) {
        const file = path.join(lessonsDir, name);
        const lesson = readJson(file);
        lessons.push({
          ...lesson,
          __path: rel(file),
          __volume: volumeNumber,
          __sourceKind: 'individual-canonical'
        });
        foundIndividual = true;
      }
    }

    if (foundIndividual) continue;
    if (!fs.existsSync(volumeDir)) continue;
    for (const name of fs.readdirSync(volumeDir).filter(file => /^draft-lessons-\d+-\d+\.json$/.test(file)).sort()) {
      const file = path.join(volumeDir, name);
      const pack = readJson(file);
      for (const lesson of arr(pack.lessons)) {
        lessons.push({
          ...lesson,
          __path: rel(file),
          __volume: volumeNumber,
          __sourceKind: 'draft-collection'
        });
      }
    }
  }
  return lessons;
}

function readEvidenceBatches() {
  if (!fs.existsSync(evidenceRoot)) return [];
  return fs.readdirSync(evidenceRoot)
    .filter(file => /^evidence-batch-\d+\.json$/.test(file))
    .sort()
    .map(file => {
      const fullPath = path.join(evidenceRoot, file);
      return {
        ...readJson(fullPath),
        __path: rel(fullPath)
      };
    });
}

const registryPath = path.join(encRoot, 'current-controlled-registry.json');
const sourceRegistryPath = path.join(evidenceRoot, 'authoritative-sources.json');
const registry = readJson(registryPath);
const sourceRegistry = fs.existsSync(sourceRegistryPath) ? readJson(sourceRegistryPath) : { sources: [] };
const volumeSourceRegisters=[];
const controlledSourceById=new Map();
for(let volumeNumber=1;volumeNumber<=21;volumeNumber+=1){
  const volume=String(volumeNumber).padStart(2,'0');
  const file=path.join(encRoot,`volume-${volume}`,'source-register.json');
  if(!fs.existsSync(file)) continue;
  const register=readJson(file);
  volumeSourceRegisters.push(rel(file));
  for(const source of arr(register.sources)){
    if(!source?.id) continue;
    if(controlledSourceById.has(source.id)) throw new Error(`Duplicate controlled volume source id ${source.id}`);
    controlledSourceById.set(source.id,{...source,__path:rel(file),__volume:volumeNumber});
  }
}
const batches = readEvidenceBatches();
const lessons = readCanonicalLessons();

const sourceById = new Map(arr(sourceRegistry.sources).map(source => [source.id, source]));
const sourceAliasToId = new Map();
for (const source of arr(sourceRegistry.sources)) {
  for (const alias of arr(source.aliases)) sourceAliasToId.set(alias, source.id);
}

const evidenceByLesson = new Map();
for (const batch of batches) {
  for (const item of arr(batch.claimEvidence)) {
    if (!evidenceByLesson.has(item.lessonId)) evidenceByLesson.set(item.lessonId, []);
    evidenceByLesson.get(item.lessonId).push({
      evidenceId: item.evidenceId,
      batchId: batch.batchId,
      sourceIds: arr(item.sourceIds),
      claimType: item.claimType,
      reviewState: item.reviewState
    });
  }
}

const lessonById = new Map(lessons.map(lesson => [lesson.id, lesson]));

function sourceRefsFor(lesson) {
  return arr(lesson.sourceNotes)
    .map(note => typeof note === 'string' ? note : (note?.id || note?.sourceId || note?.title || ''))
    .map(norm)
    .filter(Boolean);
}

function recordFor(entry) {
  const lesson = lessonById.get(entry.id);
  const refs = lesson ? sourceRefsFor(lesson) : [];
  const resolvedFromNotes = refs.map(ref => sourceById.has(ref) ? ref : sourceAliasToId.get(ref)).filter(Boolean);
  const resolvedControlledFromNotes = refs.filter(ref => controlledSourceById.has(ref));
  const claimEvidence = evidenceByLesson.get(entry.id) || [];
  const resolvedFromEvidence = claimEvidence.flatMap(item => arr(item.sourceIds)).filter(id => sourceById.has(id));
  const authoritativeSourceIds = [...new Set([...resolvedFromNotes, ...resolvedFromEvidence])].sort();
  const unresolvedSourceRefs = refs.filter(ref => !sourceById.has(ref) && !sourceAliasToId.has(ref) && !controlledSourceById.has(ref));
  const publicationAuthorized = lesson?.reviewControl?.publicationAuthorized ?? lesson?.publicationAuthorized ?? null;
  const evidenceStatus = claimEvidence.length
    ? 'claim_evidence_batch_started'
    : refs.length
      ? 'source_notes_only_claim_ledger_pending'
      : 'source_notes_missing';

  return {
    id: entry.id,
    number: entry.number,
    part: entry.part,
    title: entry.title,
    file: lesson?.__path || null,
    sourceKind: lesson?.__sourceKind || null,
    route: lesson?.route || null,
    slug: lesson?.slug || null,
    publicationState: {
      publicationAuthorized,
      websiteAction: lesson?.reviewControl?.websiteAction ?? null,
      externalReview: lesson?.reviewControl?.externalReview ?? null,
      evidenceControl: lesson?.reviewControl?.evidenceControl ?? null,
      assessmentRationaleStatus: lesson?.assessmentDesign?.answerRationaleStatus ?? null,
      preservationNote: 'Evidence tracking does not change publication or review state.'
    },
    sourceNotes: {
      count: refs.length,
      refs,
      resolvedAuthoritativeSourceIds: [...new Set(resolvedFromNotes)].sort(),
      resolvedControlledSourceIds: [...new Set(resolvedControlledFromNotes)].sort(),
      controlledSourceRecords: [...new Set(resolvedControlledFromNotes)].sort().map(id=>{
        const source=controlledSourceById.get(id);
        return {id,title:source?.title||null,location:source?.location||null,useAndLimitation:source?.useAndLimitation||null,sourceRegister:source?.__path||null};
      }),
      unresolvedRefs: unresolvedSourceRefs
    },
    evidence: {
      status: evidenceStatus,
      authoritativeSourceIds,
      claimEvidenceCount: claimEvidence.length,
      claimEvidenceIds: claimEvidence.map(item => item.evidenceId).sort(),
      batchIds: [...new Set(claimEvidence.map(item => item.batchId))].sort(),
      reviewState: claimEvidence.length ? 'source_collected_needs_independent_review' : 'claim_level_evidence_needed',
      needs: [
        ...(claimEvidence.length ? [] : ['claim_level_evidence_mapping']),
        ...(unresolvedSourceRefs.length ? ['source_note_authority_resolution'] : []),
        ...(publicationAuthorized === false ? ['publication_hold_preserved'] : [])
      ]
    }
  };
}

const trackingLessons = arr(registry.entries).map(recordFor);
const summary = {
  lessonCount: trackingLessons.length,
  withSourceNotes: trackingLessons.filter(row => row.sourceNotes.count > 0).length,
  withClaimEvidence: trackingLessons.filter(row => row.evidence.claimEvidenceCount > 0).length,
  withoutClaimEvidence: trackingLessons.filter(row => row.evidence.claimEvidenceCount === 0).length,
  withResolvedAuthoritativeSources: trackingLessons.filter(row => row.evidence.authoritativeSourceIds.length > 0).length,
  withResolvedControlledSources: trackingLessons.filter(row => row.sourceNotes.resolvedControlledSourceIds.length > 0).length,
  controlledVolumeSourceCount: controlledSourceById.size,
  publicationHoldsPreserved: trackingLessons.filter(row => row.publicationState.publicationAuthorized === false).length,
  evidenceStatuses: trackingLessons.reduce((acc, row) => {
    acc[row.evidence.status] = (acc[row.evidence.status] || 0) + 1;
    return acc;
  }, {})
};

const output = {
  schemaVersion: '1.0.0',
  artifactId: 'thc-encyclopedia-evidence-tracking',
  generatedBy: 'scripts/build-encyclopedia-evidence-tracking.mjs',
  generatedFrom: {
    controlledRegistry: rel(registryPath),
    sourceRegistry: fs.existsSync(sourceRegistryPath) ? rel(sourceRegistryPath) : null,
    volumeSourceRegisters,
    evidenceBatches: batches.map(batch => batch.__path)
  },
  scope: 'All 420 controlled THC-ENC lessons. This artifact tracks evidence-readiness only and does not authorize publication.',
  summary,
  lessons: trackingLessons
};

fs.mkdirSync(path.dirname(outPath), { recursive: true });
fs.writeFileSync(outPath, `${JSON.stringify(output, null, 2)}\n`);
console.log(`Encyclopedia evidence tracking: ${summary.lessonCount}/420 lessons · ${summary.withClaimEvidence} with claim evidence · ${summary.withoutClaimEvidence} pending claim evidence`);
console.log(`Wrote ${rel(outPath)}`);

if (summary.lessonCount !== 420) {
  console.error(`Expected 420 controlled lesson tracking rows; found ${summary.lessonCount}.`);
  process.exit(1);
}

for (let index = 0; index < 420; index += 1) {
  const expected = lessonId(index + 1);
  if (trackingLessons[index]?.id !== expected) {
    console.error(`Evidence tracking order mismatch at row ${index + 1}; expected ${expected}, found ${trackingLessons[index]?.id || '(missing)'}.`);
    process.exit(1);
  }
}
