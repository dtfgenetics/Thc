#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import { loadEncyclopediaRegistry } from './lib/encyclopedia-registry.mjs';

const root=process.cwd();
const read=p=>JSON.parse(fs.readFileSync(path.join(root,p),'utf8'));
const arr=v=>Array.isArray(v)?v:[];
const outPath=path.join(root,'data','encyclopedia-independent-review-manifest.json');
const registryState=loadEncyclopediaRegistry(root);

const readiness=read('data/encyclopedia-production-readiness.json');
const evidence=read('data/encyclopedia-evidence-tracking.json');
const rationales=read('data/encyclopedia-assessment-rationale-package.json');
const visuals=read('content/encyclopedia/visual-production-queue-v1.json');

const byId=rows=>new Map(arr(rows).map(row=>[row.id||row.lessonId,row]));
const evidenceById=byId(evidence.lessons);
const rationaleById=byId(rationales.lessons);
const visualById=byId(visuals.items);

const rows=arr(readiness.lessons).map(row=>{
  const e=evidenceById.get(row.id)||{};
  const r=rationaleById.get(row.id)||{};
  const v=visualById.get(row.id)||{};
  const evidenceCount=Number(e?.evidence?.claimEvidenceCount||0);
  const visualCandidates=arr(v.canonicalAssetPaths);
  return {
    lessonId:row.id,
    number:row.number,
    part:row.part,
    title:row.title,
    canonicalFile:row.canonicalFile,
    currentReadinessState:row.state,
    reviewTasks:{
      claimEvidence:{
        required:true,
        mapped:evidenceCount>0,
        claimEvidenceCount:evidenceCount,
        authoritativeSourceIds:arr(e?.evidence?.authoritativeSourceIds),
        currentReviewState:e?.evidence?.reviewState||null,
        requestedDecision:evidenceCount>0?'independent_science_review':'complete_evidence_mapping_then_review',
        reviewerDecision:null,
        reviewerId:null,
        reviewedAt:null,
        reviewNotes:null
      },
      assessmentRationales:{
        required:true,
        promptCount:arr(r.prompts).length,
        rationaleCount:arr(r.rationales).length,
        currentReviewState:r.reviewState||null,
        requestedDecision:'independent_assessment_and_science_review',
        reviewerDecision:null,
        reviewerId:null,
        reviewedAt:null,
        reviewNotes:null
      },
      teachingVisual:{
        required:true,
        productionStatus:v.productionStatus||null,
        candidateAssetPaths:visualCandidates,
        candidateCount:visualCandidates.length,
        accuracyReview:v.accuracyReview||null,
        accessibilityReview:v.accessibilityReview||null,
        assetQaStatus:v.assetQaStatus||null,
        requestedDecision:visualCandidates.length?'science_accessibility_rights_and_asset_qa':'produce_asset_then_review',
        reviewerDecision:null,
        reviewerId:null,
        reviewedAt:null,
        reviewNotes:null
      },
      publication:{
        currentlyAuthorized:Boolean(row.publication?.authorized),
        requestedDecision:'release_authorization_after_required_reviews',
        reviewerDecision:null,
        reviewerId:null,
        reviewedAt:null,
        reviewNotes:null
      }
    },
    blockers:arr(row.blockers),
    nextActions:arr(row.workPriority?.nextActions)
  };
});


const reviewBatchSize=20;
const readinessById=new Map(arr(readiness.lessons).map(row=>[row.id,row]));
const reviewBatches=[];
for(let start=0;start<rows.length;start+=reviewBatchSize){
  const batchRows=rows.slice(start,start+reviewBatchSize);
  const batchNumber=Math.floor(start/reviewBatchSize)+1;
  const riskScores=batchRows.map(row=>Number(readinessById.get(row.lessonId)?.workPriority?.evidenceRiskScore||0));
  const priorityScores=batchRows.map(row=>Number(readinessById.get(row.lessonId)?.workPriority?.evidencePriorityScore||0));
  const producedVisuals=batchRows.filter(row=>row.reviewTasks.teachingVisual.candidateCount>0);
  reviewBatches.push({
    batchId:`ENC-REVIEW-BATCH-${String(batchNumber).padStart(2,'0')}`,
    lessonRange:`${batchRows[0]?.lessonId || ''}..${batchRows.at(-1)?.lessonId || ''}`,
    lessonCount:batchRows.length,
    lessonIds:batchRows.map(row=>row.lessonId),
    evidenceMapped:batchRows.filter(row=>row.reviewTasks.claimEvidence.mapped).length,
    evidenceNeedsMapping:batchRows.filter(row=>!row.reviewTasks.claimEvidence.mapped).length,
    visualCandidatesPresent:batchRows.filter(row=>row.reviewTasks.teachingVisual.candidateCount>0).length,
    visualProductionNeeded:batchRows.filter(row=>row.reviewTasks.teachingVisual.candidateCount===0).length,
    rationaleReviewTasks:batchRows.length,
    evidenceReviewTasks:batchRows.filter(row=>row.reviewTasks.claimEvidence.mapped).length,
    producedVisualReviewTasks:producedVisuals.length,
    maxEvidenceRiskScore:Math.max(0,...riskScores),
    maxEvidencePriorityScore:Math.max(0,...priorityScores),
    reviewPriorityScore:Math.max(0,...priorityScores)+Math.max(0,...riskScores)+(producedVisuals.length*2),
    recommendedSequence:[
      'claim_evidence_science_review',
      ...(producedVisuals.length?['produced_visual_science_accessibility_rights_asset_qa']:[]),
      'assessment_rationale_review',
      ...(batchRows.some(row=>row.reviewTasks.teachingVisual.candidateCount===0)?['remaining_visual_production_then_review']:[]),
      'release_authorization_check'
    ],
    reviewerDecision:null,
    reviewerId:null,
    reviewedAt:null,
    reviewNotes:null
  });
}

reviewBatches.sort((a,b)=>b.reviewPriorityScore-a.reviewPriorityScore||a.batchId.localeCompare(b.batchId));
reviewBatches.forEach((batch,index)=>{batch.reviewPriorityRank=index+1;});

const summary={
  lessonCount:rows.length,
  evidenceMapped:rows.filter(x=>x.reviewTasks.claimEvidence.mapped).length,
  evidenceNeedsMapping:rows.filter(x=>!x.reviewTasks.claimEvidence.mapped).length,
  evidenceReviewTasks:rows.filter(x=>x.reviewTasks.claimEvidence.mapped).length,
  rationaleReviewTasks:rows.length,
  visualCandidatesPresent:rows.filter(x=>x.reviewTasks.teachingVisual.candidateCount>0).length,
  visualProductionNeeded:rows.filter(x=>x.reviewTasks.teachingVisual.candidateCount===0).length,
  publicationCurrentlyAuthorized:rows.filter(x=>x.reviewTasks.publication.currentlyAuthorized).length,
  generatedReviewerDecisions:0,
  reviewBatchSize,
  reviewBatchCount:reviewBatches.length
};

const output={
  schemaVersion:'1.0.0',
  artifactId:'thc-encyclopedia-independent-review-manifest',
  generatedBy:'scripts/build-encyclopedia-independent-review-manifest.mjs',
  scope:`Reviewer handoff for all ${registryState.totalCount} registered THC-ENC lessons. This artifact enumerates review work but never makes reviewer decisions.`, 
  reviewBoundary:'Generated content may prepare evidence, rationale, visual, accessibility, rights, QA, and release-review tasks. Independent reviewer identity, decision, date, and notes must come from an external review action and must never be synthesized by this builder.',
  summary,
  reviewBatches,
  lessons:rows
};

fs.mkdirSync(path.dirname(outPath),{recursive:true});
fs.writeFileSync(outPath,JSON.stringify(output,null,2)+'\n');
console.log('Encyclopedia independent-review manifest');
console.log(JSON.stringify(summary,null,2));
console.log('Wrote data/encyclopedia-independent-review-manifest.json');
if(rows.length!==registryState.totalCount) process.exitCode=1;
