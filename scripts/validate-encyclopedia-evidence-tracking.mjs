#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import { discoverEncyclopediaVolumes, readCanonicalEncyclopediaLessons } from './lib/encyclopedia-canonical-lessons.mjs';
import { loadEncyclopediaRegistry } from './lib/encyclopedia-registry.mjs';

const root = process.cwd();
const encRoot = path.join(root, 'content', 'encyclopedia');
const evidenceRoot = path.join(encRoot, 'evidence');
const trackingPath = path.join(root, 'data', 'encyclopedia-evidence-tracking.json');
const sourceRegistryPath = path.join(evidenceRoot, 'authoritative-sources.json');
const sourceQueuePath = path.join(root, 'data', 'encyclopedia-source-resolution-queue.json');

const errors = [];
const warnings = [];
const readJson = file => JSON.parse(fs.readFileSync(file, 'utf8'));
const arr = value => Array.isArray(value) ? value : [];
const rel = file => path.relative(root, file).replaceAll(path.sep, '/');
const encId = number => `THC-ENC-${String(number).padStart(3, '0')}`;
const fail = message => errors.push(message);
const warn = message => warnings.push(message);

function readEvidenceBatches() {
  if (!fs.existsSync(evidenceRoot)) return [];
  return fs.readdirSync(evidenceRoot)
    .filter(file => /^evidence-batch-\d+\.json$/.test(file))
    .sort()
    .map(file => {
      const fullPath = path.join(evidenceRoot, file);
      return { ...readJson(fullPath), __path: rel(fullPath) };
    });
}

function assertNoApprovalMutation(value, location) {
  if (Array.isArray(value)) {
    value.forEach((item, index) => assertNoApprovalMutation(item, `${location}[${index}]`));
    return;
  }
  if (!value || typeof value !== 'object') return;

  for (const [key, child] of Object.entries(value)) {
    const keyLower = key.toLowerCase();
    if ((keyLower === 'publicationauthorized' || keyLower.includes('approved')) && child === true) {
      fail(`${location}.${key}: evidence artifacts must not set approval/publication booleans true`);
    }
    if (['reviewstate', 'status', 'publicationeffect'].includes(keyLower)) {
      const normalized = String(child).toLowerCase().trim();
      if (['approved', 'publication_authorized', 'released', 'live_verified'].includes(normalized)) {
        fail(`${location}.${key}: evidence artifacts must not use terminal approval state "${child}"`);
      }
    }
    assertNoApprovalMutation(child, `${location}.${key}`);
  }
}

if (!fs.existsSync(sourceRegistryPath)) fail(`Missing authoritative source registry: ${rel(sourceRegistryPath)}`);
if (!fs.existsSync(trackingPath)) fail(`Missing generated evidence tracking artifact: ${rel(trackingPath)}`);

const registryState = loadEncyclopediaRegistry(root);
const registry = { entries: registryState.entries };
const lessons = readCanonicalEncyclopediaLessons(root);
const lessonById = new Map(lessons.map(lesson => [lesson.id, lesson]));
const expectedById = new Map(registryState.entries.map(entry => [entry.id, entry]));
const sourceRegistry = fs.existsSync(sourceRegistryPath) ? readJson(sourceRegistryPath) : { sources: [] };
const tracking = fs.existsSync(trackingPath) ? readJson(trackingPath) : { lessons: [] };
const sourceQueue = fs.existsSync(sourceQueuePath) ? readJson(sourceQueuePath) : { references: [] };
const sourceReferenceById = new Map(arr(sourceQueue.references).map(row => [row.referenceId, row]));
const batches = readEvidenceBatches();

if (registryState.coreCount !== 420) fail(`Protected core registry must contain 420 entries; found ${registryState.coreCount}`);
if (lessons.length !== registryState.totalCount) fail(`Canonical lesson resolver must find ${registryState.totalCount} registered lessons; found ${lessons.length}`);
if (tracking.schemaVersion !== '1.0.0') fail('Evidence tracking schemaVersion must be 1.0.0');
if (tracking.artifactId !== 'thc-encyclopedia-evidence-tracking') fail('Evidence tracking artifactId mismatch');
if (arr(tracking.lessons).length !== registryState.totalCount) fail(`Evidence tracking must contain ${registryState.totalCount} lessons; found ${arr(tracking.lessons).length}`);

const sourceIds = new Set();
for (const source of arr(sourceRegistry.sources)) {
  if (!/^ENC-AUTH-\d{3}$/.test(String(source.id || ''))) fail(`Invalid source id: ${source.id || '(missing)'}`);
  if (sourceIds.has(source.id)) fail(`Duplicate source id ${source.id}`);
  sourceIds.add(source.id);
  if (!source.title) fail(`${source.id}: title missing`);
  if (!source.sourceType) fail(`${source.id}: sourceType missing`);
  if (!source.authorityClass) fail(`${source.id}: authorityClass missing`);
  if (!/^https:\/\//.test(String(source.url || ''))) fail(`${source.id}: authoritative source URL must be https`);
}


for (const volumeInfo of discoverEncyclopediaVolumes(root)) {
  const volumeNumber = volumeInfo.number;
  const registerPath = path.join(encRoot, volumeInfo.name, 'source-register.json');
  if (!fs.existsSync(registerPath)) continue;
  const register = readJson(registerPath);
  for (const source of arr(register.sources)) {
    const location = String(source.location || '').trim();
    if (!/^https:\/\//.test(location)) continue;
    if (!/^V\d{2}-SRC-\d{3}$/.test(String(source.id || ''))) {
      fail(`${rel(registerPath)}: invalid external volume source id ${source.id || '(missing)'}`);
      continue;
    }
    if (sourceIds.has(source.id)) {
      fail(`Duplicate source id ${source.id}`);
      continue;
    }
    if (!source.title) fail(`${source.id}: title missing`);
    sourceIds.add(source.id);
  }
}

const evidenceIds = new Set();
const evidenceByLesson = new Map();
for (const batch of batches) {
  if (!/^ENC-EVID-BATCH-\d{3}$/.test(String(batch.batchId || ''))) fail(`${batch.__path}: invalid batchId ${batch.batchId || '(missing)'}`);
  if (batch.status !== 'source_collection_initial') fail(`${batch.batchId}: status must remain source_collection_initial`);
  if (batch.reviewState !== 'needs_independent_science_review') fail(`${batch.batchId}: reviewState must be needs_independent_science_review`);
  if (batch.publicationEffect !== 'none_review_state_unchanged') fail(`${batch.batchId}: publicationEffect must be none_review_state_unchanged`);
  assertNoApprovalMutation(batch, batch.__path);

  for (const item of arr(batch.claimEvidence)) {
    if (!/^ENC-EVID-\d{4}$/.test(String(item.evidenceId || ''))) fail(`${batch.batchId}: invalid evidenceId ${item.evidenceId || '(missing)'}`);
    if (evidenceIds.has(item.evidenceId)) fail(`Duplicate evidenceId ${item.evidenceId}`);
    evidenceIds.add(item.evidenceId);
    if (!expectedById.has(item.lessonId)) fail(`${item.evidenceId}: unknown lessonId ${item.lessonId}`);
    if (!item.supportedClaim || String(item.supportedClaim).length < 24) fail(`${item.evidenceId}: supportedClaim missing/thin`);
    if (!item.sourceLocator || String(item.sourceLocator).length < 12) fail(`${item.evidenceId}: sourceLocator missing/thin`);
    if (!item.limitations || String(item.limitations).length < 12) fail(`${item.evidenceId}: limitations missing/thin`);
    if (item.reviewState !== 'source_collected_needs_science_review') fail(`${item.evidenceId}: reviewState must be source_collected_needs_science_review`);
    for (const sourceId of arr(item.sourceIds)) {
      if (!sourceIds.has(sourceId)) fail(`${item.evidenceId}: unknown sourceId ${sourceId}`);
    }
    for (const refId of arr(item.sourceReferenceIds)) {
      const ref = sourceReferenceById.get(refId);
      if (!ref) fail(`${item.evidenceId}: unknown sourceReferenceId ${refId}`);
      else {
        if (ref.traceabilityRequired === false) fail(`${item.evidenceId}: control/context source reference ${refId} cannot be evidence`);
        if (ref.traceable !== true) fail(`${item.evidenceId}: source reference ${refId} is not traceable`);
      }
    }
    if (!arr(item.sourceIds).length && !arr(item.sourceReferenceIds).length) fail(`${item.evidenceId}: at least one sourceId or traceable sourceReferenceId required`);
    if (!evidenceByLesson.has(item.lessonId)) evidenceByLesson.set(item.lessonId, []);
    evidenceByLesson.get(item.lessonId).push(item.evidenceId);
  }
}

const seenTracking = new Set();
for (let index = 0; index < arr(tracking.lessons).length; index += 1) {
  const row = tracking.lessons[index];
  const expectedId = registryState.entries[index]?.id;
  const expected = expectedById.get(expectedId);
  if (row.id !== expectedId) fail(`Tracking row ${index + 1}: expected ${expectedId}, found ${row.id || '(missing)'}`);
  if (seenTracking.has(row.id)) fail(`Duplicate tracking row ${row.id}`);
  seenTracking.add(row.id);
  if (!expected) continue;
  if (row.number !== expected.number) fail(`${row.id}: number mismatch`);
  if (row.part !== expected.part) fail(`${row.id}: part mismatch`);
  if (row.title !== expected.title) fail(`${row.id}: title mismatch`);
  if (!row.file) fail(`${row.id}: file path missing`);
  const lesson = lessonById.get(row.id);
  if (!lesson) {
    fail(`${row.id}: canonical lesson missing`);
    continue;
  }
  const publicationAuthorized = lesson.reviewControl?.publicationAuthorized ?? lesson.publicationAuthorized ?? null;
  if (row.publicationState?.publicationAuthorized !== publicationAuthorized) {
    fail(`${row.id}: tracking publicationAuthorized changed from canonical lesson state`);
  }
  const expectedEvidenceIds = (evidenceByLesson.get(row.id) || []).slice().sort();
  const actualEvidenceIds = arr(row.evidence?.claimEvidenceIds).slice().sort();
  if (JSON.stringify(actualEvidenceIds) !== JSON.stringify(expectedEvidenceIds)) {
    fail(`${row.id}: tracking claim evidence ids do not match evidence batches`);
  }
  if (expectedEvidenceIds.length && row.evidence?.status !== 'claim_evidence_batch_started') {
    fail(`${row.id}: evidence status must be claim_evidence_batch_started when claim evidence exists`);
  }
  if (!expectedEvidenceIds.length && row.evidence?.status === 'claim_evidence_batch_started') {
    fail(`${row.id}: evidence status says claim evidence exists, but no batch item references the lesson`);
  }
}

for (const entry of arr(registry.entries)) {
  if (!seenTracking.has(entry.id)) fail(`Tracking artifact missing controlled lesson ${entry.id}`);
}

if (!evidenceIds.size) warn('No claim evidence records found. The pipeline is valid, but no initial evidence batch has been populated.');

if (errors.length) {
  console.error(`Encyclopedia evidence tracking validation failed with ${errors.length} error(s):`);
  for (const error of errors) console.error(` - ${error}`);
  if (warnings.length) {
    console.error(`Warnings (${warnings.length}):`);
    for (const warning of warnings) console.error(` - ${warning}`);
  }
  process.exit(1);
}

console.log(`Encyclopedia evidence tracking PASS: ${arr(tracking.lessons).length}/${registryState.totalCount} lessons tracked, ${sourceIds.size} authoritative sources, ${evidenceIds.size} claim-evidence records.`);
if (warnings.length) {
  console.warn(`Warnings (${warnings.length}):`);
  for (const warning of warnings) console.warn(` - ${warning}`);
}
