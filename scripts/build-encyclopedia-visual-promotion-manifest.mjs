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

for(const candidate of preflight.candidates||[]){
  const external=reviewById.get(candidate.lessonId);
  const visualTask=external?.reviewTasks?.teachingVisual||{};
  const decision=visualTask.reviewerDecision;
  const reviewerId=visualTask.reviewerId;
  const reviewedAt=visualTask.reviewedAt;
  const reviewNotes=visualTask.reviewNotes;
  const reviewerEvidenceComplete=decision==='approved' && Boolean(reviewerId) && Boolean(reviewedAt) && Boolean(reviewNotes);
  const eligible=Boolean(candidate.machinePreflightPassed) && reviewerEvidenceComplete;
  if(decision==='approved'&&!reviewerEvidenceComplete) errors.push(`${candidate.lessonId}: approval is incomplete without reviewer identity, date, and notes`);
  rows.push({
    lessonId:candidate.lessonId,
    targetRepositoryPath:candidate.targetRepositoryPath,
    machinePreflightPassed:Boolean(candidate.machinePreflightPassed),
    independentVisualReview:{
      decision:decision??null,
      reviewerId:reviewerId??null,
      reviewedAt:reviewedAt??null,
      reviewNotes:reviewNotes??null,
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
  boundary:'This manifest can identify externally approved visual assets but never writes public assets, never invents reviewer evidence, and never grants publication authorization.',
  summary:{
    candidateCount:rows.length,
    machinePreflightPassed:rows.filter(x=>x.machinePreflightPassed).length,
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
