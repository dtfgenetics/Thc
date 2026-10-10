#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import { readCanonicalEncyclopediaLessons, readJson, relativePath } from './lib/encyclopedia-canonical-lessons.mjs';
import { loadEncyclopediaRegistry } from './lib/encyclopedia-registry.mjs';
import { lessonIdFromVisualFilename, visualFilenameMatchesRole } from './lib/encyclopedia-visual-filename.mjs';
import { resolveMappedVisualAsset } from './lib/encyclopedia-visual-map-containment.mjs';

const root = process.cwd();
const outPath = path.join(root, 'content', 'encyclopedia', 'visual-production-queue-v1.json');
const registryState = loadEncyclopediaRegistry(root);
const registry = { entries: registryState.entries };
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
  const id = lessonIdFromVisualFilename(name);
  if (!id) continue;
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

const visualPriorityFor = (lesson, family, roleAddressedAssetCount) => {
  if(roleAddressedAssetCount >= targetVisualsPerLesson) return 0;
  const text = JSON.stringify([lesson.title,lesson.objective,lesson.coreScience,lesson.measureAndRecord,lesson.misconceptions]).toLowerCase();
  let score=10;
  if(['diagnostic-decision-tree','mechanism-process-diagram','measurement-workflow','labeled-structure-diagram','genetics-pedigree-diagram'].includes(family)) score+=8;
  if(/\b\d+(?:\.\d+)?\s*(?:%|ppm|ppfd|dli|ec|ph|kpa|°c|°f|hours?|days?|weeks?)\b/i.test(text)) score+=5;
  if(/diagnos|pathogen|viroid|toxic|deficien|hazard|safety|calibrat|uncertaint/.test(text)) score+=6;
  if((lesson.crossLinks?.relatedLessonIds||[]).length>2) score+=2;
  const minimumGap=Math.max(0,minimumVisualsPerLesson-roleAddressedAssetCount);
  const targetGap=Math.max(0,targetVisualsPerLesson-roleAddressedAssetCount);
  score+=minimumGap*4;
  score+=targetGap;
  if(minimumGap===0 && targetGap>0) score=Math.max(1,Math.min(score,9));
  return score;
};

const visualRoles = [
  'core-concept-overview',
  'labeled-anatomy-or-structure',
  'mechanism-or-process-sequence',
  'measurement-or-data-reference',
  'comparison-or-contrast',
  'diagnostic-or-observation-example',
  'environment-or-cultivation-context',
  'microscopy-or-detail-view',
  'misconception-correction',
  'summary-reference-graphic'
];
const visualRoleIntent = {
  'core-concept-overview': 'Orient the learner with a concise visual model of the lesson’s central idea and major relationships.',
  'labeled-anatomy-or-structure': 'Identify the physical structures, components, or spatial relationships that the learner must recognize.',
  'mechanism-or-process-sequence': 'Show the causal or chronological steps that explain how the lesson’s process works.',
  'measurement-or-data-reference': 'Show what is measured, the relevant units or observations, and how to interpret the data without inventing universal targets.',
  'comparison-or-contrast': 'Contrast closely related states, methods, structures, or outcomes so meaningful differences are visible.',
  'diagnostic-or-observation-example': 'Show observable evidence and distinguishing cues while preserving uncertainty and avoiding diagnosis from appearance alone.',
  'environment-or-cultivation-context': 'Place the concept in realistic plant, environment, or cultivation context and show important interactions.',
  'microscopy-or-detail-view': 'Magnify a fine structure or small-scale feature that is difficult to understand at normal viewing scale.',
  'misconception-correction': 'Visually contrast a common misconception with the evidence-supported interpretation taught by the lesson.',
  'summary-reference-graphic': 'Provide a compact review graphic that reinforces the lesson’s terminology, relationships, and practical takeaways.'
};
const minimumVisualsPerLesson = 8;
const targetVisualsPerLesson = visualRoles.length;

const items = lessons.map(lesson => {
  const entry = entryById.get(lesson.id) || {};
  const science = arr(lesson.coreScience);
  const misconceptions = arr(lesson.misconceptions).map(String);
  const sources = arr(lesson.sourceNotes).map(note => typeof note === 'string' ? note : (note?.title || note?.id || '')).filter(Boolean);
  const labels = (arr(lesson.terms).length ? arr(lesson.terms) : arr(lesson.termsToKnow)).map(term).filter(Boolean).slice(0, 8);
  const visualType = entry.teachingVisual || lesson.requiredTeachingVisual || 'Concept diagram';
  const produced = producedVisualById.get(lesson.id) || null;
  const mappedAssetPath = resolveMappedVisualAsset(canonicalVisualRoot, produced?.assetPath);
  const discoveredAssetPaths = arr(discoveredAssetsById.get(lesson.id));
  const canonicalAssetPaths = [...new Set([
    ...(mappedAssetPath && fs.existsSync(mappedAssetPath) ? [mappedAssetPath] : []),
    ...discoveredAssetPaths.filter(assetPath => fs.existsSync(assetPath))
  ])].sort();
  const canonicalAssetExists = canonicalAssetPaths.length > 0;
  const visualFamily = visualFamilyFor(lesson, entry);
  let visualPriorityScore = 0;
  const roleAssetPath = (role, index) => canonicalAssetPaths.find(assetPath => {
    const name = path.basename(assetPath).toLowerCase();
    return visualFilenameMatchesRole(name, lesson.id, role, index + 1);
  }) || null;
  const assignedVisualRoles = visualRoles.map((role, index) => {
    const assetPath = roleAssetPath(role, index);
    return {
      role,
      ordinal: index + 1,
      status: assetPath ? 'raster_artwork_produced_review_pending' : 'brief_ready_raster_artwork_needed',
      canonicalAssetPath: assetPath ? relativePath(root, assetPath) : null,
      teachingIntent: visualRoleIntent[role],
      productionBrief: `${visualRoleIntent[role]} Lesson: ${lesson.title}. Objective: ${lesson.objective || 'Explain the controlled lesson concept.'} Use the lesson accuracy requirements, labels, misconception guards, and source anchors; do not add unsupported numerical targets or claims.`,
      altTextDraft: `${lesson.title}: ${visualRoleIntent[role]}`,
      captionDraft: `${lesson.title} — ${role.replaceAll('-', ' ')}. Interpret this visual within the lesson context, evidence limits, and measurement method.`
    };
  });
  const roleAddressedAssetCount = assignedVisualRoles.filter(role => role.canonicalAssetPath).length;
  const unclassifiedLegacyAssetCount = Math.max(0, canonicalAssetPaths.length - roleAddressedAssetCount);
  const visualGapCount = targetVisualsPerLesson - roleAddressedAssetCount;
  const minimumVisualGapCount = Math.max(0, minimumVisualsPerLesson - roleAddressedAssetCount);
  visualPriorityScore = visualPriorityFor(lesson, visualFamily, roleAddressedAssetCount);

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
    minimumVisualsRequired: minimumVisualsPerLesson,
    targetVisuals: targetVisualsPerLesson,
    visualRoles: assignedVisualRoles,
    visualGapCount,
    minimumVisualGapCount,
    productionStatus: roleAddressedAssetCount >= minimumVisualsPerLesson ? 'minimum_visual_depth_produced_review_pending' : 'multi_visual_artwork_needed',
    canonicalAssetPath: canonicalAssetExists ? relativePath(root, canonicalAssetPaths[0]) : null,
    canonicalAssetPaths: canonicalAssetPaths.map(assetPath => relativePath(root, assetPath)),
    assetCandidateCount: canonicalAssetPaths.length,
    roleAddressedAssetCount,
    unclassifiedLegacyAssetCount,
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
  scope: `A controlled 10-role teaching-visual set for each of the ${registryState.totalCount} registered THC-ENC lessons; 8 role-addressed raster visuals are the minimum depth target.`, 
  releaseRule: 'A brief is not an approved asset. Publication requires asset-level science, accessibility, rights, and rendering QA.',
  summary: {
    lessonCount: items.length,
    briefsReady: items.length,
    minimumVisualsPerLesson,
    targetVisualsPerLesson,
    minimumVisualTarget: items.length * minimumVisualsPerLesson,
    fullVisualTarget: items.length * targetVisualsPerLesson,
    currentRasterAssetCount: items.reduce((sum,item)=>sum+item.assetCandidateCount,0),
    roleAddressedRasterAssetCount: items.reduce((sum,item)=>sum+item.roleAddressedAssetCount,0),
    unclassifiedLegacyRasterAssetCount: items.reduce((sum,item)=>sum+item.unclassifiedLegacyAssetCount,0),
    missingToMinimum: items.reduce((sum,item)=>sum+item.minimumVisualGapCount,0),
    missingToTarget: items.reduce((sum,item)=>sum+item.visualGapCount,0),
    lessonsBelowMinimum: items.filter(item=>item.minimumVisualGapCount>0).length,
    lessonsBelowTarget: items.filter(item=>item.visualGapCount>0).length,
    lessonsWithVisualGaps: items.filter(item => item.visualGapCount > 0).length,
    visualTasksNeeded: items.reduce((sum,item)=>sum+item.visualGapCount,0),
    artworkProducedReviewPending: items.filter(item => item.assetCandidateCount > 0).length,
    highestPriorityArtworkNeeded: items.filter(item => item.visualGapCount > 0).sort((a,b)=>b.visualPriorityScore-a.visualPriorityScore||b.visualGapCount-a.visualGapCount||a.number-b.number).slice(0,40).map(item=>({lessonId:item.lessonId,visualPriorityScore:item.visualPriorityScore,visualFamily:item.visualFamily,visualGapCount:item.visualGapCount,title:item.title})),
    approvedAssets: items.filter(item => item.approvedAssetId).length
  },
  items
};

fs.writeFileSync(outPath, `${JSON.stringify(output, null, 2)}\n`);
console.log(`Encyclopedia visual queue: ${items.length}/${registryState.totalCount} lessons · ${output.summary.roleAddressedRasterAssetCount}/${output.summary.fullVisualTarget} role-addressed target visuals present · ${output.summary.unclassifiedLegacyRasterAssetCount} legacy rasters unclassified · ${output.summary.missingToMinimum} missing to 8/lesson minimum · ${output.summary.missingToTarget} missing to 10/lesson target · ${output.summary.approvedAssets} approved`);
console.log(`Wrote ${relativePath(root, outPath)}`);
