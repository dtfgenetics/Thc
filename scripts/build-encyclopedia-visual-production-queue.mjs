#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import { readCanonicalEncyclopediaLessons, readJson, relativePath } from './lib/encyclopedia-canonical-lessons.mjs';

const root = process.cwd();
const outPath = path.join(root, 'content', 'encyclopedia', 'visual-production-queue-v1.json');
const registry = readJson(path.join(root, 'content', 'encyclopedia', 'current-controlled-registry.json'));
const lessons = readCanonicalEncyclopediaLessons(root);
const entryById = new Map((registry.entries || []).map(entry => [entry.id, entry]));
const arr = value => Array.isArray(value) ? value.filter(Boolean) : [];
const term = value => typeof value === 'string' ? value : value?.term;
const visualMapPath = path.join(root, 'site', 'wordpress', 'education', 'encyclopedia', 'all-visual-map-v1.json');
const visualMap = fs.existsSync(visualMapPath) ? readJson(visualMapPath) : { items: [] };
const producedVisualById = new Map(arr(visualMap.items).map(item => [item.id, item]));
const canonicalVisualRoot = path.join(root, 'site', 'wordpress', 'assets', 'infographics');
const canonicalVisualFiles = fs.existsSync(canonicalVisualRoot)
  ? fs.readdirSync(canonicalVisualRoot).filter(name => /\.(?:png|jpe?g|webp)$/i.test(name)).sort()
  : [];
const discoveredAssetsById = new Map();
for (const name of canonicalVisualFiles) {
  const match = name.match(/^(THC-ENC-\d{3})(?:_|\b)/i);
  if (!match) continue;
  const id = match[1].toUpperCase();
  const rows = discoveredAssetsById.get(id) || [];
  rows.push(path.join(canonicalVisualRoot, name));
  discoveredAssetsById.set(id, rows);
}

const visualFamilyFor = (lesson, entry) => {
  const text = JSON.stringify([
    lesson.title, lesson.objective, lesson.coreScience, lesson.cultivationRelevance,
    lesson.measureAndRecord, lesson.misconceptions, lesson.evidenceLimits
  ]).toLowerCase();
  if(/diagnos|symptom|disease|pathogen|pest|viroid|deficien|toxicit/.test(text)) return 'diagnostic-decision-tree';
  if(/cycle|pathway|transport|photosynth|respirat|signal|hormone|uptake|transpir|metaboli/.test(text)) return 'mechanism-process-diagram';
  if(/compare|versus|difference|contrast|trade-?off/.test(text)) return 'comparison-matrix';
  if(/measure|meter|calibrat|sampling|record|uncertaint|quality control|traceab/.test(text)) return 'measurement-workflow';
  if(/anatom|morpholog|root|leaf|flower|trichome|vascular|stomata/.test(text)) return 'labeled-structure-diagram';
  if(/breeding|cross|inherit|genetic|allele|segregat|backcross|selfing|selection/.test(text)) return 'genetics-pedigree-diagram';
  if(/dry|cure|storage|harvest|postharvest/.test(text)) return 'postharvest-process-diagram';
  if(/environment|vpd|temperature|humidity|light|ppfd|dli|co2|airflow/.test(text)) return 'environment-response-chart';
  return String(entry.teachingVisual || lesson.requiredTeachingVisual || 'concept-diagram').toLowerCase().replace(/\s+/g,'-');
};

const visualPriorityFor = (lesson, family, hasRaster) => {
  if(hasRaster) return 0;
  const text = JSON.stringify([lesson.title,lesson.objective,lesson.coreScience,lesson.measureAndRecord,lesson.misconceptions]).toLowerCase();
  let score=10;
  if(['diagnostic-decision-tree','mechanism-process-diagram','measurement-workflow','labeled-structure-diagram','genetics-pedigree-diagram'].includes(family)) score+=8;
  if(/\b\d+(?:\.\d+)?\s*(?:%|ppm|ppfd|dli|ec|ph|kpa|°c|°f|hours?|days?|weeks?)\b/i.test(text)) score+=5;
  if(/diagnos|pathogen|viroid|toxic|deficien|hazard|safety|calibrat|uncertaint/.test(text)) score+=6;
  if((lesson.crossLinks?.relatedLessonIds||[]).length>2) score+=2;
  return score;
};

const items = lessons.map(lesson => {
  const entry = entryById.get(lesson.id) || {};
  const science = arr(lesson.coreScience);
  const misconceptions = arr(lesson.misconceptions).map(String);
  const sources = arr(lesson.sourceNotes).map(note => typeof note === 'string' ? note : (note?.title || note?.id || '')).filter(Boolean);
  const labels = (arr(lesson.terms).length ? arr(lesson.terms) : arr(lesson.termsToKnow)).map(term).filter(Boolean).slice(0, 8);
  const visualType = entry.teachingVisual || lesson.requiredTeachingVisual || 'Concept diagram';
  const produced = producedVisualById.get(lesson.id) || null;
  const mappedAssetPath = produced?.assetPath ? path.join(canonicalVisualRoot, produced.assetPath) : null;
  const discoveredAssetPaths = arr(discoveredAssetsById.get(lesson.id));
  const canonicalAssetPaths = [...new Set([
    ...(mappedAssetPath && fs.existsSync(mappedAssetPath) ? [mappedAssetPath] : []),
    ...discoveredAssetPaths.filter(assetPath => fs.existsSync(assetPath))
  ])].sort();
  const canonicalAssetExists = canonicalAssetPaths.length > 0;
  const visualFamily = visualFamilyFor(lesson, entry);
  const visualPriorityScore = visualPriorityFor(lesson, visualFamily, canonicalAssetExists);

  return {
    queueId: `ENC-VIS-${String(lesson.number).padStart(3, '0')}`,
    lessonId: lesson.id,
    number: Number(lesson.number),
    part: lesson.__part,
    title: lesson.title,
    canonicalFile: lesson.__path,
    visualType,
    visualFamily,
    visualPriorityScore,
    rasterRequired: true,
    disallowedProductionFormats: ['svg'],
    purpose: `Teach the learner to ${String(lesson.objective || '').replace(/^./, character => character.toLowerCase()).replace(/\.$/, '')}.`,
    accuracyRequirements: science.slice(0, 3),
    requiredLabels: labels,
    misconceptionGuards: misconceptions.slice(0, 2),
    sourceAnchors: sources.slice(0, 5),
    altTextDraft: `${visualType} for ${lesson.title}, showing the lesson's controlled mechanism, comparison, or workflow without implying a universal cultivation target.`,
    captionDraft: `${lesson.title}. Interpret the depicted relationships within the lesson's stated measurement method, context, and evidence limits.`,
    productionStatus: canonicalAssetExists ? 'raster_artwork_produced_review_pending' : 'brief_ready_raster_artwork_needed',
    canonicalAssetPath: canonicalAssetExists ? relativePath(root, canonicalAssetPaths[0]) : null,
    canonicalAssetPaths: canonicalAssetPaths.map(assetPath => relativePath(root, assetPath)),
    assetCandidateCount: canonicalAssetPaths.length,
    assetProductionBatch: canonicalAssetExists
      ? (produced ? (visualMap.batch || null) : 'repository-prefix-scan-v1')
      : null,
    accuracyReview: 'pending_independent_science_review',
    accessibilityReview: canonicalAssetExists ? 'pending_review' : 'pending',
    assetQaStatus: canonicalAssetExists ? 'produced_pending_asset_qa' : 'not_started',
    approvedAssetId: null,
    publicationEffect: 'none_review_state_unchanged'
  };
});

const output = {
  schemaVersion: '1.0.0',
  artifactId: 'thc-encyclopedia-visual-production-queue-v1',
  generatedBy: 'scripts/build-encyclopedia-visual-production-queue.mjs',
  scope: 'One controlled teaching-visual brief for each of the 420 canonical THC-ENC lessons.',
  releaseRule: 'A brief is not an approved asset. Publication requires asset-level science, accessibility, rights, and rendering QA.',
  summary: {
    lessonCount: items.length,
    briefsReady: items.length,
    artworkNeeded: items.filter(item => item.productionStatus === 'brief_ready_raster_artwork_needed').length,
    artworkProducedReviewPending: items.filter(item => item.productionStatus === 'raster_artwork_produced_review_pending').length,
    highestPriorityArtworkNeeded: items.filter(item => item.productionStatus === 'brief_ready_raster_artwork_needed').sort((a,b)=>b.visualPriorityScore-a.visualPriorityScore||a.number-b.number).slice(0,40).map(item=>({lessonId:item.lessonId,visualPriorityScore:item.visualPriorityScore,visualFamily:item.visualFamily,title:item.title})),
    approvedAssets: items.filter(item => item.approvedAssetId).length
  },
  items
};

fs.writeFileSync(outPath, `${JSON.stringify(output, null, 2)}\n`);
console.log(`Encyclopedia visual queue: ${items.length}/420 controlled briefs · ${output.summary.artworkNeeded} artwork needed · ${output.summary.artworkProducedReviewPending} produced/pending review · ${output.summary.approvedAssets} approved`);
console.log(`Wrote ${relativePath(root, outPath)}`);
