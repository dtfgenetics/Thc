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
const text = value => String(value ?? '').toLowerCase();
const blob = lesson => [
  lesson.title,
  lesson.objective,
  ...(arr(lesson.coreScience)),
  ...(arr(lesson.cultivationRelevance)),
  ...(arr(lesson.measureAndRecord)),
  ...(arr(lesson.misconceptions)),
  lesson.requiredTeachingVisual
].map(text).join(' ');

function inferVisualArchetype(lesson, entry) {
  const body = blob(lesson);
  const explicit = String(entry.teachingVisual || lesson.requiredTeachingVisual || '').toLowerCase();
  if(/diagnos|differential|symptom|disorder|disease|deficien|toxicit|pathogen|pest|viroid/.test(body)) return 'diagnostic-decision-tree';
  if(/measure|meter|sensor|calibrat|sampling|sample|uncertainty|accuracy|precision|ppfd|dli|ec|ppm|ph|vpd|water activity/.test(body)) return 'measurement-workflow';
  if(/cycle|lifecycle|life cycle|developmental stage|germinat|flowering transition|pollination|fertiliz|biosynth|pathway/.test(body)) return 'process-flow';
  if(/compare|versus| vs |difference|distinguish|contrast|tradeoff|trade-off/.test(body)) return 'comparison-matrix';
  if(/anatom|morpholog|structure|organ|tissue|root|leaf|stem|trichome|flower/.test(body)) return 'labeled-structure';
  if(/gradient|transport|uptake|movement|transpir|photosynth|respirat|source.?sink|hormone/.test(body)) return 'mechanism-system-map';
  if(/timeline|hours?|days?|weeks?|stage|sequence|progression|drying|curing/.test(body)) return 'timeline-sequence';
  if(/map|distribution|spatial|canopy|site|microclimate|zone/.test(body)) return 'spatial-map';
  if(explicit.includes('table') || explicit.includes('matrix')) return 'comparison-matrix';
  return 'concept-mechanism-diagram';
}

function visualPriority(lesson, archetype, canonicalAssetExists) {
  if(canonicalAssetExists) return 0;
  const body = blob(lesson);
  let score = 20;
  if(['diagnostic-decision-tree','measurement-workflow','process-flow','mechanism-system-map'].includes(archetype)) score += 25;
  if(/diagnos|disease|pest|viroid|deficien|toxicit|safety|hazard/.test(body)) score += 20;
  if(/measure|meter|sensor|calibrat|ppfd|dli|ec|ppm|ph|vpd|water activity/.test(body)) score += 15;
  if(/root|transport|photosynth|respirat|biosynth|genetic|inherit|cross|pollination/.test(body)) score += 10;
  if(arr(lesson.sourceNotes).length >= 2) score += 5;
  return Math.min(100, score);
}
const visualMapPath = path.join(root, 'site', 'wordpress', 'education', 'encyclopedia', 'volume03-visual-map.json');
const visualMap = fs.existsSync(visualMapPath) ? readJson(visualMapPath) : { items: [] };
const producedVisualById = new Map(arr(visualMap.items).map(item => [item.id, item]));
const canonicalVisualRoot = path.join(root, 'site', 'wordpress', 'assets', 'infographics');
const canonicalVisualFiles = fs.existsSync(canonicalVisualRoot)
  ? fs.readdirSync(canonicalVisualRoot).filter(name => /\.(?:png|jpe?g|webp|svg)$/i.test(name)).sort()
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

const items = lessons.map(lesson => {
  const entry = entryById.get(lesson.id) || {};
  const science = arr(lesson.coreScience);
  const misconceptions = arr(lesson.misconceptions).map(String);
  const sources = arr(lesson.sourceNotes).map(note => typeof note === 'string' ? note : (note?.title || note?.id || '')).filter(Boolean);
  const labels = (arr(lesson.terms).length ? arr(lesson.terms) : arr(lesson.termsToKnow)).map(term).filter(Boolean).slice(0, 8);
  const visualType = entry.teachingVisual || lesson.requiredTeachingVisual || 'Concept diagram';
  const visualArchetype = inferVisualArchetype(lesson, entry);
  const produced = producedVisualById.get(lesson.id) || null;
  const mappedAssetPath = produced?.assetPath ? path.join(canonicalVisualRoot, produced.assetPath) : null;
  const discoveredAssetPaths = arr(discoveredAssetsById.get(lesson.id));
  const canonicalAssetPaths = [...new Set([
    ...(mappedAssetPath && fs.existsSync(mappedAssetPath) ? [mappedAssetPath] : []),
    ...discoveredAssetPaths.filter(assetPath => fs.existsSync(assetPath))
  ])].sort();
  const canonicalAssetExists = canonicalAssetPaths.length > 0;

  return {
    queueId: `ENC-VIS-${String(lesson.number).padStart(3, '0')}`,
    lessonId: lesson.id,
    number: Number(lesson.number),
    part: lesson.__part,
    title: lesson.title,
    canonicalFile: lesson.__path,
    visualType,
    visualArchetype,
    productionPriorityScore: visualPriority(lesson, visualArchetype, canonicalAssetExists),
    productionBatch: canonicalAssetExists ? null : (visualPriority(lesson, visualArchetype, canonicalAssetExists) >= 70 ? 'P0' : visualPriority(lesson, visualArchetype, canonicalAssetExists) >= 55 ? 'P1' : visualPriority(lesson, visualArchetype, canonicalAssetExists) >= 40 ? 'P2' : 'P3'),
    purpose: `Teach the learner to ${String(lesson.objective || '').replace(/^./, character => character.toLowerCase()).replace(/\.$/, '')}.`,
    accuracyRequirements: science.slice(0, 3),
    requiredLabels: labels,
    misconceptionGuards: misconceptions.slice(0, 2),
    sourceAnchors: sources.slice(0, 5),
    altTextDraft: `${visualType} for ${lesson.title}, showing the lesson's controlled mechanism, comparison, or workflow without implying a universal cultivation target.`,
    captionDraft: `${lesson.title}. Interpret the depicted relationships within the lesson's stated measurement method, context, and evidence limits.`,
    productionStatus: canonicalAssetExists ? 'artwork_produced_review_pending' : 'brief_ready_artwork_needed',
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
    artworkNeeded: items.filter(item => item.productionStatus === 'brief_ready_artwork_needed').length,
    artworkProducedReviewPending: items.filter(item => item.productionStatus === 'artwork_produced_review_pending').length,
    approvedAssets: items.filter(item => item.approvedAssetId).length,
    priorityBatches: {
      P0: items.filter(item => item.productionBatch === 'P0').length,
      P1: items.filter(item => item.productionBatch === 'P1').length,
      P2: items.filter(item => item.productionBatch === 'P2').length,
      P3: items.filter(item => item.productionBatch === 'P3').length
    },
    archetypes: Object.fromEntries([...new Set(items.map(item => item.visualArchetype))].sort().map(kind => [kind, items.filter(item => item.visualArchetype === kind).length]))
  },
  productionQueue: [...items]
    .filter(item => item.productionStatus === 'brief_ready_artwork_needed')
    .sort((a,b) => b.productionPriorityScore - a.productionPriorityScore || a.number - b.number)
    .map((item,index) => ({
      rank:index+1,
      lessonId:item.lessonId,
      title:item.title,
      part:item.part,
      visualArchetype:item.visualArchetype,
      productionBatch:item.productionBatch,
      productionPriorityScore:item.productionPriorityScore
    })),
  items
};

fs.writeFileSync(outPath, `${JSON.stringify(output, null, 2)}\n`);
console.log(`Encyclopedia visual queue: ${items.length}/420 controlled briefs · ${output.summary.artworkNeeded} artwork needed · ${output.summary.artworkProducedReviewPending} produced/pending review · ${output.summary.approvedAssets} approved`);
console.log(`Wrote ${relativePath(root, outPath)}`);
