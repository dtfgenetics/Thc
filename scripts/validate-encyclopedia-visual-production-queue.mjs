#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import { readCanonicalEncyclopediaLessons } from './lib/encyclopedia-canonical-lessons.mjs';
import { loadEncyclopediaRegistry } from './lib/encyclopedia-registry.mjs';

const root = process.cwd();
const queuePath = path.join(root, 'content', 'encyclopedia', 'visual-production-queue-v1.json');
const errors = [];
if (!fs.existsSync(queuePath)) errors.push('Visual production queue is missing.');
let queue = { items: [] };
if (!errors.length) {
  const rawQueue = fs.readFileSync(queuePath, 'utf8').trim();
  if (!rawQueue) errors.push('Visual production queue is empty; rebuild it before validation.');
  else {
    try { queue = JSON.parse(rawQueue); }
    catch (error) { errors.push(`Visual production queue is invalid JSON: ${error.message}`); }
  }
}
const canonical = readCanonicalEncyclopediaLessons(root);
const registryState = loadEncyclopediaRegistry(root);
const canonicalIds = new Set(canonical.map(lesson => lesson.id));
const items = Array.isArray(queue.items) ? queue.items : [];
const rasterPathPattern=/\.(?:png|jpe?g|webp)$/i;
if(!rasterPathPattern.test('candidate.png')||!rasterPathPattern.test('candidate.jpg')||!rasterPathPattern.test('candidate.webp')||rasterPathPattern.test('candidate.svg')) errors.push('Raster path validator self-check failed.');

if (items.length !== registryState.totalCount) errors.push(`Expected ${registryState.totalCount} visual briefs; found ${items.length}.`);
if (new Set(items.map(item => item.lessonId)).size !== items.length) errors.push('Visual briefs must have unique lesson IDs.');
for (const item of items) {
  if (!canonicalIds.has(item.lessonId)) errors.push(`${item.lessonId}: no canonical lesson.`);
  if (!item.visualType || !item.visualFamily || !item.purpose) errors.push(`${item.lessonId}: visual type/family or purpose missing.`);
  if (item.rasterRequired !== true) errors.push(`${item.lessonId}: rasterRequired must be true.`);
  if (!Array.isArray(item.disallowedProductionFormats) || !item.disallowedProductionFormats.includes('svg')) errors.push(`${item.lessonId}: SVG must remain disallowed for production artwork.`);
  if (!Number.isFinite(item.visualPriorityScore) || item.visualPriorityScore < 0) errors.push(`${item.lessonId}: visualPriorityScore must be a non-negative number.`);
  if (!Array.isArray(item.accuracyRequirements) || item.accuracyRequirements.length < 2) errors.push(`${item.lessonId}: needs at least 2 accuracy requirements.`);
  if (!Array.isArray(item.requiredLabels) || item.requiredLabels.length < 4) errors.push(`${item.lessonId}: needs at least 4 controlled labels.`);
  if (!Array.isArray(item.misconceptionGuards) || item.misconceptionGuards.length < 2) errors.push(`${item.lessonId}: needs at least 2 misconception guards.`);
  if (!Array.isArray(item.sourceAnchors) || item.sourceAnchors.length < 2) errors.push(`${item.lessonId}: needs at least 2 source anchors.`);
  if (!item.altTextDraft || !item.captionDraft) errors.push(`${item.lessonId}: accessibility copy is incomplete.`);
  if (item.minimumVisualsRequired !== 8 || item.targetVisuals !== 10) errors.push(`${item.lessonId}: visual depth contract must require minimum 8 and target 10 visuals.`);
  if (!Array.isArray(item.visualRoles) || item.visualRoles.length !== 10) errors.push(`${item.lessonId}: must define 10 distinct educational visual roles.`);
  else {
    if (new Set(item.visualRoles.map(role=>role.role)).size !== 10) errors.push(`${item.lessonId}: educational visual roles must be unique.`);
    const ordinals=item.visualRoles.map(role=>role.ordinal);
    if (ordinals.some(n=>!Number.isInteger(n)||n<1||n>10) || new Set(ordinals).size!==10) errors.push(`${item.lessonId}: educational visual ordinals must be unique integers 1–10.`);
    if (item.visualRoles.some(role=>!/^[-a-z0-9]+$/.test(String(role.role||'')))) errors.push(`${item.lessonId}: visual role identifiers must use safe lowercase slug characters.`);
    for (const role of item.visualRoles) {
      if (!role.teachingIntent || !role.productionBrief) errors.push(`${item.lessonId}:${role.role}: role-specific teaching intent/brief missing.`);
      if (!role.altTextDraft || !role.captionDraft) errors.push(`${item.lessonId}:${role.role}: role-specific accessibility copy missing.`);
    }
  }
  if (!Number.isInteger(item.roleAddressedAssetCount) || item.roleAddressedAssetCount < 0 || item.roleAddressedAssetCount > 10) errors.push(`${item.lessonId}: role-addressed asset count is invalid.`);
  if (!Number.isInteger(item.unclassifiedLegacyAssetCount) || item.unclassifiedLegacyAssetCount < 0) errors.push(`${item.lessonId}: unclassified legacy asset count is invalid.`);
  if (Number(item.roleAddressedAssetCount) + Number(item.unclassifiedLegacyAssetCount) !== Number(item.assetCandidateCount)) errors.push(`${item.lessonId}: classified and legacy asset counts must equal candidate count.`);
  if (!Number.isInteger(item.visualGapCount) || item.visualGapCount !== 10 - Number(item.roleAddressedAssetCount || 0)) errors.push(`${item.lessonId}: target visual gap count is inconsistent.`);
  if (!Number.isInteger(item.minimumVisualGapCount) || item.minimumVisualGapCount !== Math.max(0, 8 - Number(item.roleAddressedAssetCount || 0))) errors.push(`${item.lessonId}: minimum visual gap count is inconsistent.`);
  for (const role of item.visualRoles || []) {
    if (role.canonicalAssetPath && !String(role.canonicalAssetPath).includes(`_${String(role.ordinal).padStart(2,'0')}_${role.role}.png`)) errors.push(`${item.lessonId}: role asset must encode its ordinal and role in the filename.`);
  }
  if (item.approvedAssetId !== null) errors.push(`${item.lessonId}: queue builder must not approve an asset.`);
  if (item.assetCandidateCount > 0) {
    if (!item.canonicalAssetPath) errors.push(`${item.lessonId}: produced artwork must name its canonical asset path.`);
    else if (!fs.existsSync(path.join(root, item.canonicalAssetPath))) errors.push(`${item.lessonId}: canonical produced artwork is missing from the repository.`);
    if (!Array.isArray(item.canonicalAssetPaths) || item.canonicalAssetPaths.length < 1) errors.push(`${item.lessonId}: produced artwork must retain its canonical candidate list.`);
    else {
      for (const assetPath of item.canonicalAssetPaths) {
        if (!fs.existsSync(path.join(root, assetPath))) errors.push(`${item.lessonId}: visual candidate is missing from the repository: ${assetPath}`);
        if (!rasterPathPattern.test(String(assetPath))) errors.push(`${item.lessonId}: production visual candidate must be raster: ${assetPath}`);
      }
      if (Number(item.assetCandidateCount) !== item.canonicalAssetPaths.length) errors.push(`${item.lessonId}: asset candidate count does not match canonical asset paths.`);
    }
    if (item.assetQaStatus !== 'produced_pending_asset_qa') errors.push(`${item.lessonId}: produced artwork must remain pending asset QA.`);
  }
  if (Number(item.roleAddressedAssetCount || 0) < 10 && Number(item.visualPriorityScore || 0) <= 0) errors.push(`${item.lessonId}: incomplete target visual set must retain positive production priority.`);
  if (Number(item.roleAddressedAssetCount || 0) >= 10 && Number(item.visualPriorityScore || 0) !== 0) errors.push(`${item.lessonId}: complete target visual set must have zero production priority.`);
  const expectedStatus = item.minimumVisualGapCount > 0 ? 'multi_visual_artwork_needed' : 'minimum_visual_depth_produced_review_pending';
  if (item.productionStatus !== expectedStatus) errors.push(`${item.lessonId}: production status must reflect the 8-visual minimum depth contract.`);
  if (!/pending/.test(String(item.accuracyReview))) errors.push(`${item.lessonId}: accuracy review must remain pending.`);
  if (item.publicationEffect !== 'none_review_state_unchanged') errors.push(`${item.lessonId}: visual brief must not change publication state.`);
}
for (const lesson of canonical) if (!items.some(item => item.lessonId === lesson.id)) errors.push(`${lesson.id}: missing visual brief.`);
const expectedVisualTasksNeeded=items.reduce((sum,item)=>sum+Number(item.visualGapCount||0),0);
const expectedLessonsWithVisualGaps=items.filter(item=>Number(item.visualGapCount||0)>0).length;
if(queue.summary?.visualTasksNeeded!==expectedVisualTasksNeeded) errors.push(`Queue summary visualTasksNeeded must equal ${expectedVisualTasksNeeded}; found ${queue.summary?.visualTasksNeeded}.`);
if(queue.summary?.missingToTarget!==expectedVisualTasksNeeded) errors.push('Queue summary missingToTarget must equal visualTasksNeeded.');
if(queue.summary?.lessonsWithVisualGaps!==expectedLessonsWithVisualGaps) errors.push(`Queue summary lessonsWithVisualGaps must equal ${expectedLessonsWithVisualGaps}; found ${queue.summary?.lessonsWithVisualGaps}.`);
if(queue.summary?.roleAddressedRasterAssetCount + queue.summary?.unclassifiedLegacyRasterAssetCount !== queue.summary?.currentRasterAssetCount) errors.push('Queue summary raster counts do not reconcile.');

if (errors.length) {
  console.error(`Encyclopedia visual queue validation failed with ${errors.length} error(s):`);
  errors.slice(0, 80).forEach(error => console.error(` - ${error}`));
  process.exit(1);
}
console.log(`Encyclopedia visual queue PASS: ${items.length}/${registryState.totalCount} lessons enforce 8-10 raster educational visuals with distinct roles; all produced assets remain review-pending and no artwork is misclassified as approved.`);

