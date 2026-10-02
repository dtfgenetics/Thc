#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const readJson = (rel, fallback = null) => {
  const file = path.join(root, rel);
  if (!fs.existsSync(file)) return fallback;
  return JSON.parse(fs.readFileSync(file, 'utf8'));
};
const writeJson = (rel, value) => {
  const file = path.join(root, rel);
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, `${JSON.stringify(value, null, 2)}\n`);
};
const arr = (value) => Array.isArray(value) ? value : [];
const text = (value) => String(value ?? '').trim();
const encId = (number) => `THC-ENC-${String(number).padStart(3, '0')}`;
const stableSlug = (number) => `thc-enc-${String(number).padStart(3, '0')}`;
const slugify = (value) => text(value).toLowerCase()
  .normalize('NFKD')
  .replace(/[\u0300-\u036f]/g, '')
  .replace(/&/g, ' and ')
  .replace(/[^a-z0-9]+/g, '-')
  .replace(/^-|-$/g, '');
const stableGeneratedAt = (rel) => {
  if (process.env.ENCYCLOPEDIA_BUILD_TIMESTAMP) return process.env.ENCYCLOPEDIA_BUILD_TIMESTAMP;
  const previous = readJson(rel, null);
  return previous?.generatedAt ?? 'source-controlled';
};

const registry = readJson('content/encyclopedia/current-controlled-registry.json');
const partsRegistry = readJson('content/encyclopedia/parts.json');
const topicConfig = readJson('configuration/encyclopedia-topics.json');
const searchLanguage = readJson('configuration/encyclopedia-search-language.json', { rules: [] });
const discovery = readJson('site/public-route-patch/learn/encyclopedia/encyclopedia-index.json', { lessons: [], topics: [] });
const scorecard = readJson('data/encyclopedia-completion-scorecard.json', { lessons: [] });
const evidenceTracking = readJson('data/encyclopedia-evidence-tracking.json', { lessons: [] });
const visualQueue = readJson('content/encyclopedia/visual-production-queue-v1.json', { items: [], summary: {} });
const productionBatch = readJson('site/wordpress/education/encyclopedia/current-production-batch.json', {});

const topicsByPart = new Map(arr(topicConfig.topics).map((topic) => [Number(topic.part), topic]));
const partsByPart = new Map(arr(partsRegistry.parts).map((part) => [Number(part.part), part]));
const discoveryById = new Map(arr(discovery.lessons).map((row) => [row.id, row]));
const scoreById = new Map(arr(scorecard.lessons).map((row) => [row.id, row]));
const evidenceById = new Map(arr(evidenceTracking.lessons).map((row) => [row.id, row]));
const visualById = new Map(arr(visualQueue.items).map((row) => [row.lessonId, row]));

function aliasesFor(entry) {
  return [...new Set(arr(searchLanguage.rules)
    .filter((rule) => arr(rule.targetParts).includes(Number(entry.part)) || arr(rule.targetLessonIds).includes(entry.id))
    .flatMap((rule) => arr(rule.aliases))
    .map(text)
    .filter(Boolean))];
}

function toolIdsFor(part) {
  const ids = new Set(['growlens']);
  if ([3, 5, 7].includes(part)) ['water-quality-lab', 'ph-meter', 'tds-meter'].forEach((id) => ids.add(id));
  if ([5, 6].includes(part)) ['vpd-chart', 'ppfd-chart', 'environment-control'].forEach((id) => ids.add(id));
  if ([3, 7].includes(part)) ['dryback-lab', 'fertigation-lab', 'root-zone-temperature'].forEach((id) => ids.add(id));
  if ([1, 4, 10, 11, 12, 14, 15, 16, 17].includes(part)) ids.add('atlas');
  if ([12, 13].includes(part)) ids.add('terpene-atlas');
  if ([14, 15, 16, 17].includes(part)) ['grow-doc', 'ipm-scout'].forEach((id) => ids.add(id));
  if (part === 18) ids.add('dry-cure-lab');
  if ([8, 20].includes(part)) ids.add('breeder-pedigree');
  if ([2, 9, 10, 11, 18, 19].includes(part)) ids.add('grow-planner');
  return [...ids].sort();
}

function templateTypeFor(entry) {
  const part = Number(entry.part);
  const format = text(entry.primaryFormat).toLowerCase();
  if (part === 15) return 'pest-diagnostic-reference';
  if (part === 16) return 'disease-viroid-reference';
  if (part === 14) return 'abiotic-diagnostic-reference';
  if (part === 17) return 'ipm-biosecurity-reference';
  if (part === 21 || format.includes('data') || format.includes('qa')) return 'measurement-research-reference';
  if ([12, 13].includes(part)) return 'secondary-metabolite-reference';
  return 'plant-science-reference';
}

function sourcePathFor(number) {
  const volume = String(Math.ceil(number / 20)).padStart(2, '0');
  const individual = `content/encyclopedia/volume-${volume}/lessons/${stableSlug(number)}.json`;
  if (fs.existsSync(path.join(root, individual))) return individual;
  const dir = path.join(root, `content/encyclopedia/volume-${volume}`);
  if (!fs.existsSync(dir)) return null;
  for (const name of fs.readdirSync(dir).filter((file) => /^draft-lessons-\d+-\d+\.json$/.test(file))) {
    const rel = `content/encyclopedia/volume-${volume}/${name}`;
    const pack = readJson(rel, { lessons: [] });
    if (arr(pack.lessons).some((lesson) => lesson.id === encId(number))) return rel;
  }
  return null;
}

function legacyRedirects(entry, lessonSource) {
  const out = [];
  const titleRoute = `/learn/encyclopedia/${slugify(entry.title)}/`;
  if (titleRoute !== `/learn/encyclopedia/${stableSlug(entry.number)}/`) {
    out.push({ from: titleRoute, to: `/learn/encyclopedia/${stableSlug(entry.number)}/`, reason: 'title-derived route preserved as redirect candidate' });
  }
  const rawRoute = text(lessonSource?.route);
  if (rawRoute && rawRoute !== `/learn/encyclopedia/${stableSlug(entry.number)}/`) {
    const normalized = rawRoute.startsWith('/') ? rawRoute : `/${rawRoute}`;
    out.push({ from: normalized.endsWith('/') ? normalized : `${normalized}/`, to: `/learn/encyclopedia/${stableSlug(entry.number)}/`, reason: 'legacy lesson source route preserved as redirect candidate' });
  }
  return out;
}

function readLessonSource(entry) {
  const rel = sourcePathFor(entry.number);
  if (!rel) return null;
  const json = readJson(rel, null);
  if (json?.id === entry.id) return json;
  return arr(json?.lessons).find((lesson) => lesson.id === entry.id) ?? null;
}

const parts = arr(partsRegistry.parts).map((part) => {
  const partNumber = Number(part.part);
  const topic = topicsByPart.get(partNumber) ?? {};
  const startNumber = (partNumber - 1) * 20 + 1;
  const entryIds = Array.from({ length: 20 }, (_, index) => encId(startNumber + index));
  return {
    part: partNumber,
    canonicalTitle: part.title,
    displayTitle: topic.title ?? part.title,
    slug: topic.slug ?? slugify(part.title),
    startId: part.startId,
    endId: part.endId,
    scope: part.scope,
    entryIds,
    hub: {
      route: `/learn/encyclopedia/?topic=${partNumber}`,
      description: topic.description ?? part.scope,
      primaryTemplate: partNumber === 15 ? 'pest library hub' : partNumber === 16 ? 'disease library hub' : partNumber === 14 ? 'diagnostic library hub' : 'part hub'
    },
    integrations: {
      tools: toolIdsFor(partNumber),
      atlasRoutes: [1, 4, 10, 11, 12, 14, 15, 16, 17].includes(partNumber) ? ['/atlas/'] : [],
      diagnosticRoutes: [14, 15, 16, 17].includes(partNumber) ? ['/thc-grow-doc/', '/ipm-scout/'] : []
    }
  };
});

const redirects = [];
const entries = arr(registry.entries).map((entry) => {
  const number = Number(entry.number);
  const partNumber = Number(entry.part);
  const lesson = readLessonSource(entry);
  const discoveryRow = discoveryById.get(entry.id) ?? {};
  const scoreRow = scoreById.get(entry.id) ?? {};
  const evidenceRow = evidenceById.get(entry.id) ?? {};
  const visualRow = visualById.get(entry.id) ?? {};
  const entryRedirects = legacyRedirects(entry, lesson);
  redirects.push(...entryRedirects.map((redirect) => ({ id: entry.id, ...redirect })));
  return {
    id: entry.id,
    number,
    part: partNumber,
    title: entry.title,
    stableSlug: stableSlug(number),
    titleSlug: slugify(entry.title),
    canonicalRoute: `/learn/encyclopedia/${stableSlug(number)}/`,
    reviewRoute: `/learn/encyclopedia/?lesson=${encodeURIComponent(entry.id)}`,
    sourcePath: sourcePathFor(number),
    authority: entry.authority,
    primaryFormat: entry.primaryFormat,
    templateType: templateTypeFor(entry),
    publicationStatus: discoveryRow.status ?? 'catalogued-review',
    requiredTeachingVisual: entry.teachingVisual ?? null,
    aliases: aliasesFor(entry),
    tools: toolIdsFor(partNumber),
    redirects: entryRedirects,
    production: {
      readiness: scoreRow.readiness ?? 'unknown',
      readinessScore: scoreRow.score ?? null,
      missing: arr(scoreRow.missing),
      publicationAuthorized: scoreRow.publicationAuthorized ?? null,
      evidenceStatus: evidenceRow.evidence?.status ?? 'unknown',
      claimEvidenceCount: evidenceRow.evidence?.claimEvidenceCount ?? 0,
      resolvedAuthoritativeSources: arr(evidenceRow.sourceNotes?.resolvedAuthoritativeSourceIds),
      visualProductionStatus: visualRow.productionStatus ?? 'unknown',
      approvedVisualAssetId: visualRow.approvedAssetId ?? null,
      visualQaStatus: visualRow.assetQaStatus ?? 'unknown'
    }
  };
});

const subjectLibrary = [
  { id: 'plant-biology-anatomy', title: 'Plant Biology & Anatomy', parts: [1, 4, 10] },
  { id: 'lifecycle-propagation', title: 'Lifecycle & Propagation', parts: [2, 9, 11] },
  { id: 'roots-rhizosphere', title: 'Roots & Rhizosphere', parts: [3] },
  { id: 'environment-vpd', title: 'Environment & VPD', parts: [5] },
  { id: 'water-ph-ec', title: 'Water / pH / EC', parts: [3, 5, 7, 21] },
  { id: 'lighting', title: 'Lighting', parts: [6] },
  { id: 'nutrition-media', title: 'Nutrition & Media', parts: [3, 7] },
  { id: 'genetics-breeding', title: 'Genetics & Breeding', parts: [8, 20] },
  { id: 'flowering-reproduction', title: 'Flowering & Reproduction', parts: [11] },
  { id: 'cannabinoids-trichomes', title: 'Cannabinoids & Trichomes', parts: [12] },
  { id: 'terpenes-metabolites', title: 'Terpenes & Secondary Metabolites', parts: [13] },
  { id: 'plant-health-diagnostics', title: 'Plant Health & Diagnostics', parts: [14, 15, 16, 17] },
  { id: 'pest-management-ipm', title: 'Pest Management / IPM', parts: [15, 17] },
  { id: 'harvest-dry-cure', title: 'Harvest / Dry / Cure', parts: [18] },
  { id: 'outdoor', title: 'Outdoor', parts: [19] },
  { id: 'greenhouse', title: 'Greenhouse', parts: [19] }
];

const specializedTemplates = [
  {
    id: 'plant-science-reference',
    appliesToParts: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 18, 19, 20, 21],
    requiredSections: ['objective', 'terms', 'coreScience', 'cultivationRelevance', 'measureAndRecord', 'misconceptions', 'evidenceLimits', 'crossLinks', 'sourceNotes']
  },
  {
    id: 'abiotic-diagnostic-reference',
    appliesToParts: [14],
    requiredSections: ['identification', 'pattern', 'favorableConditions', 'lookAlikes', 'evidenceForAgainst', 'confirmation', 'records', 'managementPrinciples']
  },
  {
    id: 'pest-diagnostic-reference',
    appliesToParts: [15],
    requiredSections: ['identification', 'damage', 'distribution', 'lifeCycle', 'favorableConditions', 'lookAlikes', 'confirmation', 'records', 'managementPrinciples']
  },
  {
    id: 'disease-viroid-reference',
    appliesToParts: [16],
    requiredSections: ['causalOrganism', 'hostTissue', 'symptoms', 'diseaseCycle', 'transmission', 'samplingTesting', 'differentialDiagnosis', 'biosecurity']
  },
  {
    id: 'ipm-biosecurity-reference',
    appliesToParts: [17],
    requiredSections: ['prevention', 'scouting', 'thresholdReasoning', 'sanitation', 'biosecurity', 'records', 'verification']
  }
];

const manifest = {
  schemaVersion: 'thc-encyclopedia-canonical-manifest@1',
  manifestId: 'thc-encyclopedia-canonical-420-manifest',
  generatedBy: 'scripts/build-encyclopedia-canonical-manifest.mjs',
  generatedAt: stableGeneratedAt('content/encyclopedia/canonical-420-manifest.json'),
  sourceAuthority: {
    registry: 'content/encyclopedia/current-controlled-registry.json',
    registrySchemaVersion: registry.schemaVersion,
    parts: 'content/encyclopedia/parts.json',
    topicConfig: 'configuration/encyclopedia-topics.json',
    searchLanguage: 'configuration/encyclopedia-search-language.json',
    productionBatch: 'site/wordpress/education/encyclopedia/current-production-batch.json'
  },
  identityContract: {
    coreIdPattern: 'THC-ENC-001..THC-ENC-420',
    coreStart: 'THC-ENC-001',
    coreEnd: 'THC-ENC-420',
    coreCount: 420,
    partCount: 21,
    lessonsPerPart: 20,
    expansionRule: 'New non-duplicate topics must use THC-ENC-421+ without recycling or renumbering the controlled 001-420 base.'
  },
  systemsBoundary: {
    encyclopediaIsSeparateFromCertification: true,
    certificationCourseNamespace: 'COURSE-LH-*',
    certificationLessonNamespace: 'LESSON-LH-*',
    encyclopediaMayBeOptionalReferenceOnly: true,
    encyclopediaMayCountTowardCredentialCompletion: false
  },
  publicSurfaces: {
    encyclopediaHome: '/learn/encyclopedia/',
    azIndex: '/learn/encyclopedia/#az',
    search: '/learn/search/',
    subjectLibrary: '/learn/',
    visualLibrary: '/learn/infographics/',
    sourcesEvidence: '/learn/encyclopedia/#sources-evidence',
    glossary: '/learn/glossary/',
    plantAtlas: '/atlas/',
    growDoc: '/thc-grow-doc/'
  },
  parts,
  entries,
  expansionEntries: arr(registry.entries).filter((entry) => Number(entry.number) > 420).map((entry) => entry.id),
  redirects,
  subjectLibrary,
  specializedTemplates,
  knowledgeGraph: {
    relationshipTypes: ['prerequisite', 'related', 'causes', 'affects', 'measured-by', 'diagnosed-by', 'confused-with', 'treatment-principle', 'plant-part', 'lifecycle-stage', 'tool-consumer'],
    validationRule: 'Every explicit THC-ENC relationship must resolve to a controlled or expansion encyclopedia entry and may not self-link.'
  },
  releaseGates: {
    structuralIntegrity: ['420 core entries', '21 parts', '20 entries per part', 'unique IDs', 'unique routes', 'unique slugs'],
    productionCompleteness: ['substantive lesson contract', 'claim-level evidence', 'approved teaching visual', 'alt text', 'license/rights status', 'search record', 'relationship integrity', 'review state'],
    publicationSafety: ['no placeholder text', 'no explicit draft/publication hold in published records', 'no review-only body leakage', 'stable URL or redirect candidate', 'visitor-facing verification before live claim'],
    currentProductionBatch: {
      batch: productionBatch.batch ?? null,
      publicationAuthorized: productionBatch.publicationAuthorized ?? null,
      status: productionBatch.status ?? null
    }
  }
};

writeJson('content/encyclopedia/canonical-420-manifest.json', manifest);
writeJson('site/wordpress/education/encyclopedia/redirects.json', {
  schemaVersion: 1,
  generatedBy: 'scripts/build-encyclopedia-canonical-manifest.mjs',
  generatedAt: manifest.generatedAt,
  rule: 'Redirect candidates preserve title-derived or legacy source routes while stable lesson routes remain /learn/encyclopedia/thc-enc-###/.',
  redirects
});

console.log(`Canonical encyclopedia manifest: ${manifest.entries.length} entries, ${manifest.parts.length} parts, ${manifest.redirects.length} redirect candidates.`);
