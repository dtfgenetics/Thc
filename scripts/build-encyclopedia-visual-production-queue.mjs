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
    approvedAssets: items.filter(item => item.approvedAssetId).length
  },
  items
};

fs.writeFileSync(outPath, `${JSON.stringify(output, null, 2)}\n`);
console.log(`Encyclopedia visual queue: ${items.length}/420 controlled briefs · ${output.summary.artworkNeeded} artwork needed · ${output.summary.artworkProducedReviewPending} produced/pending review · ${output.summary.approvedAssets} approved`);
console.log(`Wrote ${relativePath(root, outPath)}`);
