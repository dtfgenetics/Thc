#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';

const root=process.cwd();
const preflight=JSON.parse(fs.readFileSync(path.join(root,'data','encyclopedia-visual-machine-preflight.json'),'utf8'));
const review=JSON.parse(fs.readFileSync(path.join(root,'data','encyclopedia-independent-review-manifest.json'),'utf8'));
const batches=JSON.parse(fs.readFileSync(path.join(root,'content','encyclopedia','visual-production-batches','index.json'),'utf8'));
const reviewById=new Map((review.lessons||[]).map(x=>[x.lessonId,x]));
const batchByLesson=new Map();
for(const batch of batches.batches||[]) for(const id of batch.lessonIds||[]) batchByLesson.set(id,batch.batchId);

const rows=(preflight.candidates||[]).map(row=>{
  const visualTask=reviewById.get(row.lessonId)?.reviewTasks?.teachingVisual||{};
  const blockers=[];
  if(!row.machinePreflightPassed) blockers.push('machine_visual_preflight_failed');
  if(row.evidenceMappingRequired) blockers.push('claim_evidence_mapping_required');
  if(visualTask.reviewerDecision!=='approved') blockers.push('independent_visual_review_pending');
  if(!visualTask.reviewerId) blockers.push('reviewer_identity_missing');
  if(!visualTask.reviewedAt) blockers.push('review_timestamp_missing');
  if(!visualTask.reviewNotes) blockers.push('review_notes_missing');
  return {
    lessonId:row.lessonId,
    title:row.title,
    batchId:batchByLesson.get(row.lessonId)||null,
    visualFamily:row.visualFamily,
    machinePreflightPassed:row.machinePreflightPassed,
    evidenceMappingRequired:row.evidenceMappingRequired,
    claimEvidenceCount:row.claimEvidenceCount,
    independentVisualReview:{
      decision:visualTask.reviewerDecision??null,
      reviewerId:visualTask.reviewerId??null,
      reviewedAt:visualTask.reviewedAt??null,
      reviewNotes:visualTask.reviewNotes??null
    },
    blockers,
    nextAction:blockers.includes('machine_visual_preflight_failed')
      ? 'repair_visual_candidate'
      : blockers.includes('claim_evidence_mapping_required')
        ? 'complete_claim_evidence_mapping'
        : blockers.includes('independent_visual_review_pending')
          ? 'perform_independent_visual_review'
          : 'eligible_for_controlled_promotion_check'
  };
});
const rankAction={repair_visual_candidate:0,complete_claim_evidence_mapping:1,perform_independent_visual_review:2,eligible_for_controlled_promotion_check:3};
rows.sort((a,b)=>rankAction[a.nextAction]-rankAction[b.nextAction]||String(a.batchId).localeCompare(String(b.batchId))||a.lessonId.localeCompare(b.lessonId));

const out={
  schemaVersion:'1.0.0',
  artifactId:'thc-encyclopedia-visual-review-work-queue',
  generatedBy:'scripts/build-encyclopedia-visual-review-work-queue.mjs',
  boundary:'This queue schedules remaining work. It never synthesizes reviewer identity, decision, notes, evidence support, or publication authorization.',
  summary:{
    candidateCount:rows.length,
    machinePreflightPassed:rows.filter(x=>x.machinePreflightPassed).length,
    evidenceMappingRequired:rows.filter(x=>x.evidenceMappingRequired).length,
    awaitingIndependentVisualReview:rows.filter(x=>x.machinePreflightPassed&&!x.evidenceMappingRequired&&x.independentVisualReview.decision!=='approved').length,
    promotionCheckEligible:rows.filter(x=>x.nextAction==='eligible_for_controlled_promotion_check').length
  },
  workQueue:rows.map((x,i)=>({rank:i+1,...x}))
};
fs.writeFileSync(path.join(root,'data','encyclopedia-visual-review-work-queue.json'),JSON.stringify(out,null,2)+'\n');
console.log(JSON.stringify(out.summary,null,2));
