#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';

const root=process.cwd();
const preflightPath=path.join(root,'data','encyclopedia-visual-machine-preflight.json');
const reviewPath=path.join(root,'data','encyclopedia-independent-review-manifest.json');
const outPath=path.join(root,'data','encyclopedia-visual-promotion-manifest.json');

if(!fs.existsSync(preflightPath)) throw new Error('Missing machine preflight. Run build-encyclopedia-visual-machine-preflight.mjs first.');
if(!fs.existsSync(reviewPath)) throw new Error('Missing independent review manifest.');

const preflight=JSON.parse(fs.readFileSync(preflightPath,'utf8'));
const review=JSON.parse(fs.readFileSync(reviewPath,'utf8'));
const reviewById=new Map((review.lessons||[]).map(x=>[x.lessonId,x]));
const rows=[];
const errors=[];
const visualQueuePath=path.join(root,'content','encyclopedia','visual-production-queue-v1.json');
const visualQueue=fs.existsSync(visualQueuePath)?JSON.parse(fs.readFileSync(visualQueuePath,'utf8')):{items:[]};
const visualById=new Map((visualQueue.items||[]).map(x=>[x.lessonId,x]));

for(const candidate of preflight.candidates||[]){
  const external=reviewById.get(candidate.lessonId);
  const visualReviewRoot=external?.reviewTasks?.teachingVisual||{};
  const candidateTaskId=candidate.visualTaskId||`${candidate.lessonId}:${candidate.visualRole||'legacy'}:${candidate.visualOrdinal||0}`;
  const visualTask=visualReviewRoot.visualReviews?.[candidateTaskId]||{};
  const decision=visualTask.decision;
  const reviewerId=visualTask.reviewerId;
  const reviewedAt=visualTask.reviewedAt;
  const reviewNotes=visualTask.reviewNotes;
  const reviewChecks=visualTask.reviewChecks||{};
  const controlledChecksComplete=['scienceAccuracy','labelingAccuracy','misconceptionSafety','accessibilityQuality','provenanceRights','responsiveLegibility'].every(key=>reviewChecks[key]===true);
  const reviewerEvidenceComplete=decision==='approved' && Boolean(reviewerId) && Boolean(reviewedAt) && Boolean(reviewNotes) && controlledChecksComplete;
  const queueRow=visualById.get(candidate.lessonId)||{};
  const assetPaths=Array.isArray(queueRow.canonicalAssetPaths)?queueRow.canonicalAssetPaths:[];
  const expectedTarget=String(candidate.targetRepositoryPath||'');
  const assetPresent=assetPaths.includes(expectedTarget) && fs.existsSync(path.join(root,expectedTarget));
  const eligible=Boolean(candidate.machinePreflightPassed) && reviewerEvidenceComplete && assetPresent;
  if(decision==='approved'&&!reviewerEvidenceComplete) errors.push(`${candidateTaskId}: approval is incomplete without reviewer identity, date, notes, and all six controlled review checks`);
  rows.push({
    lessonId:candidate.lessonId,
    visualTaskId:candidateTaskId,
    visualRole:candidate.visualRole||null,
    visualOrdinal:candidate.visualOrdinal||null,
    targetRepositoryPath:candidate.targetRepositoryPath,
    machinePreflightPassed:Boolean(candidate.machinePreflightPassed),
    candidateAssetPresent:assetPresent,
    candidateAssetPaths:assetPaths,
    independentVisualReview:{
      decision:decision??null,
      reviewerId:reviewerId??null,
      reviewedAt:reviewedAt??null,
      reviewNotes:reviewNotes??null,
      reviewChecks,
      evidenceComplete:reviewerEvidenceComplete
    },
    promotionEligible:eligible,
    publicationEffect:'none'
  });
}

const output={
  schemaVersion:'1.0.0',
  artifactId:'thc-encyclopedia-visual-promotion-manifest',
  generatedBy:'scripts/build-encyclopedia-visual-promotion-manifest.mjs',
  boundary:'This manifest evaluates each visual task independently. Approval of one role never authorizes sibling visuals for the same lesson. It never writes public assets, invents reviewer evidence, or grants publication authorization; eligibility also requires the exact target raster to exist in the canonical queue/repository.',
  summary:{
    candidateCount:rows.length,
    machinePreflightPassed:rows.filter(x=>x.machinePreflightPassed).length,
    candidateAssetPresent:rows.filter(x=>x.candidateAssetPresent).length,
    externallyApprovedVisuals:rows.filter(x=>x.independentVisualReview.evidenceComplete).length,
    promotionEligible:rows.filter(x=>x.promotionEligible).length
  },
  errors,
  items:rows
};

fs.writeFileSync(outPath,JSON.stringify(output,null,2)+'\n');
console.log(JSON.stringify(output.summary,null,2));
if(errors.length){
  console.error('Promotion manifest validation failed:');
  errors.forEach(x=>console.error(' - '+x));
  process.exit(1);
}
console.log(`Promotion gate complete: ${output.summary.promotionEligible} candidate(s) eligible. No files were published.`);
