#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import { loadEncyclopediaRegistry } from './lib/encyclopedia-registry.mjs';

const root = process.cwd();
const outPath = path.join(root,'data','encyclopedia-production-readiness.json');
const registryState = loadEncyclopediaRegistry(root);

const read = p => JSON.parse(fs.readFileSync(path.join(root,p),'utf8'));
const arr = v => Array.isArray(v) ? v : [];
const bool = v => v === true;

const scorecard = read('data/encyclopedia-completion-scorecard.json');
const evidence = read('data/encyclopedia-evidence-tracking.json');
const rationales = read('data/encyclopedia-assessment-rationale-package.json');
const visuals = read('content/encyclopedia/visual-production-queue-v1.json');
const sourceQueue = read('data/encyclopedia-source-resolution-queue.json');
const evidencePriority = fs.existsSync(path.join(root,'data','encyclopedia-evidence-priority.json'))
  ? read('data/encyclopedia-evidence-priority.json')
  : { lessons: [] };
const practicalRegistry = fs.existsSync(path.join(root,'content','encyclopedia','downloads','registry.json'))
  ? read('content/encyclopedia/downloads/registry.json')
  : { resources: [] };

const byId = rows => new Map(arr(rows).map(row => [row.id || row.lessonId, row]));
const scoreById = byId(scorecard.lessons);
const evidenceById = byId(evidence.lessons);
const rationaleById = byId(rationales.lessons);
const visualById = byId(visuals.items);
const sourceById = byId(sourceQueue.lessons || sourceQueue.items || []);
const priorityById = byId(evidencePriority.lessons || []);

const practicalCounts = new Map();
for (const resource of arr(practicalRegistry.resources)) {
  for (const id of arr(resource.lessonIds)) {
    practicalCounts.set(id,(practicalCounts.get(id)||0)+1);
  }
}

const ids = [...scoreById.keys()].sort((a,b)=>Number(a.match(/\d+/)[0])-Number(b.match(/\d+/)[0]));

const lessons = ids.map(id => {
  const s = scoreById.get(id) || {};
  const e = evidenceById.get(id) || {};
  const r = rationaleById.get(id) || {};
  const v = visualById.get(id) || {};
  const q = sourceById.get(id) || {};
  const p = priorityById.get(id) || {};

  const contentComplete = s.contentContractComplete === true;
  const claimEvidenceMapped = Number(e?.evidence?.claimEvidenceCount || 0) > 0;
  const claimEvidenceReviewState = String(e?.evidence?.reviewState || '');
  const claimEvidenceReviewed = ['independent_science_review_complete','approved'].includes(claimEvidenceReviewState);
  const claimEvidenceComplete = claimEvidenceMapped && claimEvidenceReviewed;
  const sourcesResolved = q.resolutionState === 'authority_links_available_claim_review_pending' || q.resolutionState === 'source_traceable_authority_review_pending';
  const visualApproved = Boolean(v.approvedAssetId) && v.assetQaStatus === 'approved';
  const rationaleReviewed = r.reviewState === 'approved' || r.reviewState === 'independent_review_complete';
  const publicationAuthorized = bool(s.publicationAuthorized) || bool(e?.publicationState?.publicationAuthorized);

  const blockers = [];
  if(!contentComplete) blockers.push('content_contract_incomplete');
  if(!claimEvidenceComplete) blockers.push('claim_evidence_incomplete');
  if(!sourcesResolved) blockers.push('source_resolution_incomplete');
  if(!visualApproved) blockers.push('teaching_visual_not_approved');
  if(!rationaleReviewed) blockers.push('assessment_rationale_review_pending');
  if(!publicationAuthorized) blockers.push('publication_not_authorized');

  const nextActions = [];
  if(!contentComplete) nextActions.push('repair_lesson_content_contract');
  if(!claimEvidenceMapped) nextActions.push('map_atomic_claim_evidence');
  else if(!claimEvidenceReviewed) nextActions.push('independent_claim_evidence_review');
  if(!sourcesResolved) nextActions.push('resolve_source_authority_and_exact_locator');
  if(!visualApproved) nextActions.push('produce_and_review_teaching_visual');
  if(!rationaleReviewed) nextActions.push('independent_assessment_rationale_review');
  if(!publicationAuthorized) nextActions.push('complete_release_review_before_authorization');

  let state = 'blocked';
  if(blockers.length === 0) state = 'release_ready';
  else if(contentComplete && sourcesResolved) state = 'review_pipeline';
  else state = 'production_incomplete';

  return {
    id,
    number:s.number,
    part:s.part,
    topic:s.topic,
    title:s.title,
    canonicalFile:s.file,
    state,
    readinessScore:Number(s.score || 0),
    contentScore:Number(s.contentScore || 0),
    contentMaxScore:Number(s.contentMaxScore || 0),
    content:{
      complete:contentComplete,
      missing:arr(s.missing)
    },
    evidence:{
      claimEvidenceCount:Number(e?.evidence?.claimEvidenceCount || 0),
      claimEvidenceMapped,
      claimEvidenceReviewState:claimEvidenceReviewState||null,
      claimEvidenceReviewed,
      claimEvidenceComplete,
      authoritativeSourceCount:arr(e?.evidence?.authoritativeSourceIds).length,
      unresolvedSourceRefs:arr(e?.sourceNotes?.unresolvedRefs),
      sourceTraceabilityState:q.resolutionState || null,
      sourcesResolved
    },
    visual:{
      briefReady:Boolean(v.queueId),
      approved:visualApproved,
      approvedAssetId:v.approvedAssetId || null,
      accuracyReview:v.accuracyReview || null,
      accessibilityReview:v.accessibilityReview || null,
      assetQaStatus:v.assetQaStatus || null
    },
    assessment:{
      promptCount:arr(r.prompts).length,
      rationaleCount:arr(r.rationales).length,
      reviewState:r.reviewState || null,
      reviewed:rationaleReviewed
    },
    practicalResources:{
      count:practicalCounts.get(id) || 0,
      requiredForRelease:false,
      note:'Practical resources are optional unless a lesson-specific production requirement marks them required.'
    },
    publication:{
      authorized:publicationAuthorized,
      websiteAction:e?.publicationState?.websiteAction ?? null,
      externalReview:e?.publicationState?.externalReview ?? null
    },
    blockers,
    workPriority:{
      evidenceRiskScore:Number(p.riskScore || 0),
      evidencePriorityScore:Number(p.priorityScore || 0),
      riskFlags:p.riskFlags || {},
      nextActions
    },
    sourceResolutionState:q.resolutionState || null,
    optionalLinks:{
      coursesRequired:false,
      note:'Academy/Course membership is intentionally not an Encyclopedia completion or release criterion.'
    }
  };
});

const count = fn => lessons.filter(fn).length;
const blockerCounts = {};
for(const lesson of lessons){
  for(const blocker of lesson.blockers) blockerCounts[blocker]=(blockerCounts[blocker]||0)+1;
}
const byPart = [...new Set(lessons.map(x=>x.part))].sort((a,b)=>a-b).map(part=>{
  const rows=lessons.filter(x=>x.part===part);
  return {
    part,
    lessonCount:rows.length,
    contentComplete:rows.filter(x=>x.content.complete).length,
    evidenceComplete:rows.filter(x=>x.evidence.claimEvidenceComplete && x.evidence.sourcesResolved).length,
    visualApproved:rows.filter(x=>x.visual.approved).length,
    rationaleReviewed:rows.filter(x=>x.assessment.reviewed).length,
    publicationAuthorized:rows.filter(x=>x.publication.authorized).length,
    releaseReady:rows.filter(x=>x.state==='release_ready').length
  };
});

const workQueue = [...lessons]
  .filter(x=>x.state!=='release_ready')
  .sort((a,b)=>
    b.workPriority.evidencePriorityScore-a.workPriority.evidencePriorityScore ||
    b.workPriority.evidenceRiskScore-a.workPriority.evidenceRiskScore ||
    b.blockers.length-a.blockers.length ||
    a.number-b.number
  )
  .map((x,index)=>({
    rank:index+1,
    lessonId:x.id,
    part:x.part,
    title:x.title,
    state:x.state,
    blockers:x.blockers,
    nextActions:x.workPriority.nextActions,
    evidencePriorityScore:x.workPriority.evidencePriorityScore,
    evidenceRiskScore:x.workPriority.evidenceRiskScore
  }));

const output = {
  schemaVersion:'1.0.0',
  artifactId:'thc-encyclopedia-production-readiness',
  generatedBy:'scripts/build-encyclopedia-production-readiness.mjs',
  scope:'All controlled THC-ENC lessons. Encyclopedia readiness is independent of Academy/Course membership.',
  releaseRule:'A lesson is release_ready only when its content contract, claim evidence/source resolution, teaching visual QA, assessment-rationale review, and publication authorization are all complete.',
  summary:{
    lessonCount:lessons.length,
    contentComplete:count(x=>x.content.complete),
    evidenceMapped:count(x=>x.evidence.claimEvidenceMapped),
    evidenceReviewed:count(x=>x.evidence.claimEvidenceReviewed),
    evidenceComplete:count(x=>x.evidence.claimEvidenceComplete && x.evidence.sourcesResolved),
    visualApproved:count(x=>x.visual.approved),
    rationaleReviewed:count(x=>x.assessment.reviewed),
    publicationAuthorized:count(x=>x.publication.authorized),
    releaseReady:count(x=>x.state==='release_ready'),
    productionIncomplete:count(x=>x.state==='production_incomplete'),
    reviewPipeline:count(x=>x.state==='review_pipeline'),
    blockerCounts
  },
  byPart,
  workQueue,
  lessons
};

fs.writeFileSync(outPath,JSON.stringify(output,null,2)+'\n');
console.log('Encyclopedia production readiness');
console.log(JSON.stringify(output.summary,null,2));
console.log('Wrote data/encyclopedia-production-readiness.json');

if(lessons.length !== registryState.totalCount){
  console.error(`Expected ${registryState.totalCount} readiness rows; found ${lessons.length}`);
  process.exit(1);
}
