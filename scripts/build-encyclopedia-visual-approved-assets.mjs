#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';

const root=process.cwd();
const promotionPath=path.join(root,'data','encyclopedia-visual-promotion-manifest.json');
const out=path.join(root,'data','encyclopedia-visual-approved-assets.json');

if(!fs.existsSync(promotionPath)) throw new Error('Missing visual promotion manifest.');
const promotion=JSON.parse(fs.readFileSync(promotionPath,'utf8'));
const rows=[];
const errors=[];
const seenTasks=new Set();
const seenPaths=new Set();
const requiredChecks=['scienceAccuracy','labelingAccuracy','misconceptionSafety','accessibilityQuality','provenanceRights','responsiveLegibility'];

for(const item of promotion.items||[]){
  if(!item.promotionEligible) continue;
  const rel=String(item.targetRepositoryPath||'');
  const expectedName=`${item.lessonId}_${String(item.visualOrdinal).padStart(2,'0')}_${item.visualRole}.png`;
  const expectedPath=`site/wordpress/assets/infographics/${expectedName}`;
  const taskId=`${item.lessonId}:${item.visualRole}:${item.visualOrdinal}`;
  const review=item.independentVisualReview||{};
  const reviewComplete=review.evidenceComplete===true && review.decision==='approved' && Boolean(String(review.reviewerId||'').trim()) && Boolean(String(review.reviewedAt||'').trim()) && Boolean(String(review.reviewNotes||'').trim()) && requiredChecks.every(key=>review.reviewChecks?.[key]===true);
  if(!item.machinePreflightPassed || !item.controlledTargetValid || !item.candidateAssetPresent || !reviewComplete){
    errors.push(`${taskId}: promotion eligibility lacks preflight, controlled asset, or complete independent reviewer evidence`);
    continue;
  }
  if(seenTasks.has(taskId)||seenPaths.has(rel)){
    errors.push(`${taskId}: duplicate approved visual task or repository path`);
    continue;
  }
  seenTasks.add(taskId);
  seenPaths.add(rel);
  if(!/^THC-ENC-\d{3,}$/.test(item.lessonId||'') || !Number.isInteger(item.visualOrdinal) || item.visualOrdinal<1 || item.visualOrdinal>10 || !/^[a-z0-9][a-z0-9_-]*$/i.test(item.visualRole||'') || rel!==expectedPath){
    errors.push(`${item.lessonId}: invalid target path`);
    continue;
  }
  const abs=path.join(root,rel);
  if(!fs.existsSync(abs)){
    errors.push(`${item.lessonId}: eligible target raster missing`);
    continue;
  }
  const buf=fs.readFileSync(abs);
  if(buf.subarray(0,8).toString('hex')!=='89504e470d0a1a0a'){
    errors.push(`${item.lessonId}: target is not PNG`);
    continue;
  }
  const sha256=crypto.createHash('sha256').update(buf).digest('hex');
  rows.push({
    lessonId:item.lessonId,
    approvedAssetId:`ENC-ASSET-${item.lessonId}-${item.visualOrdinal}-${item.visualRole}-${sha256.slice(0,12)}`,
    visualTaskId:taskId,
    visualRole:item.visualRole,
    visualOrdinal:item.visualOrdinal,
    repositoryPath:rel,
    sha256,
    bytes:buf.length,
    assetQaStatus:'approved',
    reviewDecision:item.independentVisualReview?.decision||null,
    reviewerId:item.independentVisualReview?.reviewerId||null,
    reviewedAt:item.independentVisualReview?.reviewedAt||null,
    publicationAuthorized:false
  });
}
if(errors.length){
  errors.forEach(x=>console.error(' - '+x));
  process.exit(1);
}
const output={
  schemaVersion:'1.0.0',
  artifactId:'thc-encyclopedia-visual-approved-assets',
  generatedBy:'scripts/build-encyclopedia-visual-approved-assets.mjs',
  boundary:'This ledger records exact repository rasters that cleared machine preflight and validated independent visual review. It does not grant lesson publication authorization.',
  summary:{approvedAssetCount:rows.length},
  assets:rows
};
fs.writeFileSync(out,JSON.stringify(output,null,2)+'\n');
console.log(JSON.stringify(output.summary,null,2));
