#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const readJson = (rel) => JSON.parse(fs.readFileSync(path.join(root, rel), 'utf8'));
const exists = (rel) => fs.existsSync(path.join(root, rel));
const arr = (value) => Array.isArray(value) ? value : [];
const text = (value) => String(value ?? '').trim();
const encId = (number) => `THC-ENC-${String(number).padStart(3, '0')}`;
const stableSlug = (number) => `thc-enc-${String(number).padStart(3, '0')}`;
const errors = [];
const warnings = [];
const fail = (message) => errors.push(message);
const warn = (message) => warnings.push(message);

for (const file of [
  'content/encyclopedia/schemas/canonical-manifest-v1.schema.json',
  'content/encyclopedia/canonical-420-manifest.json',
  'content/encyclopedia/current-controlled-registry.json',
  'content/encyclopedia/parts.json',
  'configuration/encyclopedia-topics.json',
  'site/public-route-patch/learn/encyclopedia/encyclopedia-index.json',
  'data/encyclopedia-completion-scorecard.json',
  'data/encyclopedia-evidence-tracking.json',
  'content/encyclopedia/visual-production-queue-v1.json',
  'content/encyclopedia/evidence/authoritative-sources.json'
]) {
  if (!exists(file)) fail(`required architecture file missing: ${file}`);
}

if (errors.length) {
  for (const error of errors) console.error(`ERROR: ${error}`);
  process.exit(1);
}

const manifest = readJson('content/encyclopedia/canonical-420-manifest.json');
const registry = readJson('content/encyclopedia/current-controlled-registry.json');
const partsRegistry = readJson('content/encyclopedia/parts.json');
const topics = readJson('configuration/encyclopedia-topics.json');
const discovery = readJson('site/public-route-patch/learn/encyclopedia/encyclopedia-index.json');
const scorecard = readJson('data/encyclopedia-completion-scorecard.json');
const evidenceTracking = readJson('data/encyclopedia-evidence-tracking.json');
const visualQueue = readJson('content/encyclopedia/visual-production-queue-v1.json');
const sourceRegistry = readJson('content/encyclopedia/evidence/authoritative-sources.json');

if (manifest.schemaVersion !== 'thc-encyclopedia-canonical-manifest@1') fail('canonical manifest schemaVersion mismatch');
if (manifest.manifestId !== 'thc-encyclopedia-canonical-420-manifest') fail('canonical manifest id mismatch');
if (manifest.identityContract?.coreCount !== 420) fail('canonical core count must be 420');
if (manifest.identityContract?.partCount !== 21) fail('canonical part count must be 21');
if (manifest.systemsBoundary?.encyclopediaIsSeparateFromCertification !== true) fail('encyclopedia/certification boundary must be explicit');
if (manifest.systemsBoundary?.encyclopediaMayCountTowardCredentialCompletion !== false) fail('encyclopedia must not count toward credential completion');

const registryEntries = arr(registry.entries);
const manifestEntries = arr(manifest.entries);
const manifestParts = arr(manifest.parts);
if (registryEntries.length !== 420) fail(`controlled registry must contain exactly 420 entries; found ${registryEntries.length}`);
if (manifestEntries.length !== 420) fail(`canonical manifest must contain exactly 420 entries; found ${manifestEntries.length}`);
if (manifestParts.length !== 21) fail(`canonical manifest must contain 21 parts; found ${manifestParts.length}`);
if (arr(partsRegistry.parts).length !== 21) fail('parts registry must contain 21 parts');
if (arr(topics.topics).length !== 21) fail('topic configuration must contain 21 part hubs');

const ids = new Set();
const routes = new Set();
const slugs = new Set();
const titleSlugs = new Set();
const registryById = new Map(registryEntries.map((entry) => [entry.id, entry]));
const discoveryById = new Map(arr(discovery.lessons).map((entry) => [entry.id, entry]));
const scoreById = new Map(arr(scorecard.lessons).map((entry) => [entry.id, entry]));
const evidenceById = new Map(arr(evidenceTracking.lessons).map((entry) => [entry.id, entry]));
const visualById = new Map(arr(visualQueue.items).map((entry) => [entry.lessonId, entry]));

for (let partNumber = 1; partNumber <= 21; partNumber += 1) {
  const part = manifestParts.find((row) => row.part === partNumber);
  const registryPart = arr(partsRegistry.parts).find((row) => row.part === partNumber);
  const topic = arr(topics.topics).find((row) => row.part === partNumber);
  const start = (partNumber - 1) * 20 + 1;
  const end = start + 19;
  if (!part) {
    fail(`manifest missing part ${partNumber}`);
    continue;
  }
  if (!registryPart) fail(`parts registry missing part ${partNumber}`);
  if (!topic) fail(`topic config missing part ${partNumber}`);
  if (part.startId !== encId(start) || part.endId !== encId(end)) fail(`part ${partNumber} must span ${encId(start)}-${encId(end)}`);
  if (part.canonicalTitle !== registryPart?.title) fail(`part ${partNumber} canonical title mismatch`);
  if (part.displayTitle !== topic?.title) fail(`part ${partNumber} display title mismatch`);
  if (arr(part.entryIds).length !== 20) fail(`part ${partNumber} must list 20 entry IDs`);
  for (let number = start; number <= end; number += 1) {
    if (!arr(part.entryIds).includes(encId(number))) fail(`part ${partNumber} missing entry ${encId(number)}`);
  }
  if (!part.hub?.route || !part.hub?.description) fail(`part ${partNumber} hub metadata incomplete`);
}

for (const entry of manifestEntries) {
  if (!/^THC-ENC-\d{3}$/.test(entry.id)) fail(`invalid core entry ID ${entry.id}`);
  if (ids.has(entry.id)) fail(`duplicate entry ID ${entry.id}`);
  ids.add(entry.id);
  if (routes.has(entry.canonicalRoute)) fail(`duplicate canonical route ${entry.canonicalRoute}`);
  routes.add(entry.canonicalRoute);
  if (slugs.has(entry.stableSlug)) fail(`duplicate stable slug ${entry.stableSlug}`);
  slugs.add(entry.stableSlug);
  if (titleSlugs.has(entry.titleSlug)) warn(`duplicate title-derived slug ${entry.titleSlug}; stable ID route remains authoritative`);
  titleSlugs.add(entry.titleSlug);

  const expected = registryById.get(entry.id);
  if (!expected) {
    fail(`${entry.id}: missing from controlled registry`);
    continue;
  }
  if (entry.number !== expected.number) fail(`${entry.id}: number mismatch`);
  if (entry.part !== expected.part) fail(`${entry.id}: part mismatch`);
  if (entry.title !== expected.title) fail(`${entry.id}: title mismatch`);
  if (entry.stableSlug !== stableSlug(entry.number)) fail(`${entry.id}: stable slug must be ${stableSlug(entry.number)}`);
  if (entry.canonicalRoute !== `/learn/encyclopedia/${stableSlug(entry.number)}/`) fail(`${entry.id}: canonical route is not stable ID route`);
  if (!entry.sourcePath || !exists(entry.sourcePath)) fail(`${entry.id}: sourcePath missing or absent on disk`);
  if (!entry.templateType) fail(`${entry.id}: template type missing`);
  if (!entry.requiredTeachingVisual) fail(`${entry.id}: required teaching visual missing`);

  const discoveryRow = discoveryById.get(entry.id);
  if (!discoveryRow) {
    fail(`${entry.id}: missing from encyclopedia discovery/search index`);
  } else {
    for (const field of ['id', 'title', 'part', 'topic', 'topicSlug', 'status', 'route', 'primaryFormat', 'keywords']) {
      if (!(field in discoveryRow)) fail(`${entry.id}: discovery record missing ${field}`);
    }
    if (!arr(discoveryRow.keywords).map((value) => String(value).toLowerCase()).includes(entry.id.toLowerCase())) {
      fail(`${entry.id}: discovery keywords must include stable ID`);
    }
    if (discoveryRow.status === 'published') {
      for (const field of ['objective', 'terms', 'coreScience', 'measurements', 'misconceptions', 'tools', 'aliases']) {
        if (!(field in discoveryRow)) fail(`${entry.id}: published discovery row missing rich field ${field}`);
      }
      if (/(todo|lorem|placeholder|coming soon|draft only)/i.test(JSON.stringify(discoveryRow))) {
        fail(`${entry.id}: published discovery row contains placeholder/draft language`);
      }
    }
    if (discoveryRow.status === 'catalogued-review') {
      for (const field of ['objective', 'terms', 'coreScience', 'cultivation', 'measurements', 'misconceptions', 'evidenceLimits', 'crossLinks', 'synonyms']) {
        const value = discoveryRow[field];
        const empty = Array.isArray(value) ? value.length === 0 : text(value) === '';
        if (!empty) fail(`${entry.id}: review-only discovery row leaked ${field}`);
      }
    }
  }

  const score = scoreById.get(entry.id);
  if (!score) fail(`${entry.id}: missing from completion scorecard`);
  else if (!Array.isArray(score.missing) || !Number.isFinite(score.score)) fail(`${entry.id}: invalid scorecard row`);

  const evidence = evidenceById.get(entry.id);
  if (!evidence) fail(`${entry.id}: missing from evidence tracking`);
  else if (!evidence.evidence?.status) fail(`${entry.id}: evidence status missing`);

  const visual = visualById.get(entry.id);
  if (!visual) fail(`${entry.id}: missing from visual production queue`);
  else {
    for (const field of ['visualType', 'purpose', 'altTextDraft', 'captionDraft', 'productionStatus', 'assetQaStatus']) {
      if (!text(visual[field])) fail(`${entry.id}: visual queue row missing ${field}`);
    }
    if (visual.approvedAssetId && (!text(visual.altTextDraft) || !text(visual.captionDraft))) {
      fail(`${entry.id}: approved visual must retain alt/caption metadata`);
    }
  }
}

for (const entry of registryEntries) {
  if (!ids.has(entry.id)) fail(`controlled registry entry missing from manifest: ${entry.id}`);
}

if (arr(discovery.lessons).length !== 420) fail(`discovery index must contain exactly 420 core rows; found ${arr(discovery.lessons).length}`);
if (arr(discovery.topics).length !== 21) fail(`discovery index must contain 21 topics; found ${arr(discovery.topics).length}`);
if (!discovery.facets?.topic || !discovery.facets?.format || !discovery.facets?.status) fail('discovery index missing required facets');
if (scorecard.lessonCount !== 420) fail('scorecard must cover 420 lessons');
if (evidenceTracking.summary?.lessonCount !== 420) fail('evidence tracking must cover 420 lessons');
if (visualQueue.summary?.lessonCount !== 420) fail('visual queue must cover 420 lessons');

const sourceIds = new Set();
for (const source of arr(sourceRegistry.sources)) {
  if (!/^ENC-AUTH-\d{3,}$/.test(source.id ?? '')) fail(`invalid source id ${source.id}`);
  if (sourceIds.has(source.id)) fail(`duplicate source id ${source.id}`);
  sourceIds.add(source.id);
  if (!text(source.title) || !text(source.sourceType) || !text(source.authorityClass)) fail(`${source.id}: source metadata incomplete`);
  if (source.url) {
    try {
      const parsed = new URL(source.url);
      if (parsed.protocol !== 'https:') fail(`${source.id}: source URL must use https`);
    } catch {
      fail(`${source.id}: invalid source URL`);
    }
  }
}

const validRelationshipIds = new Set(manifestEntries.map((entry) => entry.id));
for (const entry of manifestEntries) {
  if (!entry.sourcePath || !exists(entry.sourcePath)) continue;
  const source = readJson(entry.sourcePath);
  const lesson = source?.id === entry.id ? source : arr(source?.lessons).find((row) => row.id === entry.id);
  const raw = JSON.stringify(lesson?.crossLinks ?? '');
  const links = [...new Set(raw.match(/THC-ENC-\d{3}/g) ?? [])];
  if (links.includes(entry.id)) fail(`${entry.id}: relationship graph self-link`);
  for (const link of links) {
    if (!validRelationshipIds.has(link)) fail(`${entry.id}: relationship graph links unknown ID ${link}`);
  }
}

const redirectPairs = new Set();
for (const redirect of arr(manifest.redirects)) {
  if (!redirect.id || !validRelationshipIds.has(redirect.id)) fail(`redirect candidate references unknown ID ${redirect.id}`);
  if (!redirect.from || !redirect.to) fail(`redirect candidate incomplete for ${redirect.id}`);
  const key = `${redirect.from}->${redirect.to}`;
  if (redirectPairs.has(key)) warn(`duplicate redirect candidate ${key}`);
  redirectPairs.add(key);
}

if (!arr(manifest.subjectLibrary).length) fail('subject library mapping missing');
for (const subject of arr(manifest.subjectLibrary)) {
  if (!subject.id || !subject.title || !arr(subject.parts).length) fail(`invalid subject library row ${subject.id ?? '<missing>'}`);
  for (const part of arr(subject.parts)) if (part < 1 || part > 21) fail(`${subject.id}: invalid part ${part}`);
}

const templateIds = new Set(arr(manifest.specializedTemplates).map((template) => template.id));
for (const required of ['plant-science-reference', 'abiotic-diagnostic-reference', 'pest-diagnostic-reference', 'disease-viroid-reference', 'ipm-biosecurity-reference']) {
  if (!templateIds.has(required)) fail(`specialized template missing ${required}`);
}

if (errors.length) {
  console.error(`Canonical encyclopedia architecture validation failed with ${errors.length} error(s):`);
  for (const error of errors.slice(0, 100)) console.error(` - ${error}`);
  if (errors.length > 100) console.error(` - ... ${errors.length - 100} more`);
  process.exit(1);
}

console.log(`Canonical encyclopedia architecture PASS: ${manifestEntries.length}/420 entries, ${manifestParts.length} parts, ${arr(manifest.redirects).length} redirect candidates.`);
if (warnings.length) {
  console.warn(`Warnings (${warnings.length}):`);
  for (const warning of warnings.slice(0, 40)) console.warn(` - ${warning}`);
}
