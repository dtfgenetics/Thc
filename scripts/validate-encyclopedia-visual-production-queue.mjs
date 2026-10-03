#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import { readCanonicalEncyclopediaLessons } from './lib/encyclopedia-canonical-lessons.mjs';

const root = process.cwd();
const queuePath = path.join(root, 'content', 'encyclopedia', 'visual-production-queue-v1.json');
const errors = [];
if (!fs.existsSync(queuePath)) errors.push('Visual production queue is missing.');
const queue = errors.length ? { items: [] } : JSON.parse(fs.readFileSync(queuePath, 'utf8'));
const canonical = readCanonicalEncyclopediaLessons(root);
const canonicalIds = new Set(canonical.map(lesson => lesson.id));
const items = Array.isArray(queue.items) ? queue.items : [];

if (items.length !== 420) errors.push(`Expected 420 visual briefs; found ${items.length}.`);
if (new Set(items.map(item => item.lessonId)).size !== items.length) errors.push('Visual briefs must have unique lesson IDs.');
for (const item of items) {
  if (!canonicalIds.has(item.lessonId)) errors.push(`${item.lessonId}: no canonical lesson.`);
  if (!item.visualType || !item.purpose) errors.push(`${item.lessonId}: visual type or purpose missing.`);
  if (!Array.isArray(item.accuracyRequirements) || item.accuracyRequirements.length < 2) errors.push(`${item.lessonId}: needs at least 2 accuracy requirements.`);
  if (!Array.isArray(item.requiredLabels) || item.requiredLabels.length < 4) errors.push(`${item.lessonId}: needs at least 4 controlled labels.`);
  if (!Array.isArray(item.misconceptionGuards) || item.misconceptionGuards.length < 2) errors.push(`${item.lessonId}: needs at least 2 misconception guards.`);
  if (!Array.isArray(item.sourceAnchors) || item.sourceAnchors.length < 2) errors.push(`${item.lessonId}: needs at least 2 source anchors.`);
  if (!item.altTextDraft || !item.captionDraft) errors.push(`${item.lessonId}: accessibility copy is incomplete.`);
  if (item.approvedAssetId !== null) errors.push(`${item.lessonId}: queue builder must not approve an asset.`);
  if (item.productionStatus === 'artwork_produced_review_pending') {
    if (!item.canonicalAssetPath) errors.push(`${item.lessonId}: produced artwork must name its canonical asset path.`);
    else if (!fs.existsSync(path.join(root, item.canonicalAssetPath))) errors.push(`${item.lessonId}: canonical produced artwork is missing from the repository.`);
    if (!Array.isArray(item.canonicalAssetPaths) || item.canonicalAssetPaths.length < 1) errors.push(`${item.lessonId}: produced artwork must retain its canonical candidate list.`);
    else {
      for (const assetPath of item.canonicalAssetPaths) {
        if (!fs.existsSync(path.join(root, assetPath))) errors.push(`${item.lessonId}: visual candidate is missing from the repository: ${assetPath}`);
      }
      if (Number(item.assetCandidateCount) !== item.canonicalAssetPaths.length) errors.push(`${item.lessonId}: asset candidate count does not match canonical asset paths.`);
    }
    if (item.assetQaStatus !== 'produced_pending_asset_qa') errors.push(`${item.lessonId}: produced artwork must remain pending asset QA.`);
  } else if (item.productionStatus !== 'brief_ready_artwork_needed') {
    errors.push(`${item.lessonId}: unsupported visual production status ${item.productionStatus}.`);
  }
  if (!/pending/.test(String(item.accuracyReview))) errors.push(`${item.lessonId}: accuracy review must remain pending.`);
  if (item.publicationEffect !== 'none_review_state_unchanged') errors.push(`${item.lessonId}: visual brief must not change publication state.`);
}
for (const lesson of canonical) if (!items.some(item => item.lessonId === lesson.id)) errors.push(`${lesson.id}: missing visual brief.`);

if (errors.length) {
  console.error(`Encyclopedia visual queue validation failed with ${errors.length} error(s):`);
  errors.slice(0, 80).forEach(error => console.error(` - ${error}`));
  process.exit(1);
}
console.log(`Encyclopedia visual queue PASS: 420/420 lessons have controlled briefs; ${items.filter(item=>item.productionStatus==='artwork_produced_review_pending').length} produced assets remain review-pending and no artwork is misclassified as approved.`);
