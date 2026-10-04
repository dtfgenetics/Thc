#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';

const root=process.cwd();
const batchDir=path.join(root,'content','encyclopedia','visual-production-batches');
const outPath=path.join(root,'data','encyclopedia-visual-machine-preflight.json');
const files=fs.readdirSync(batchDir).filter(n=>/^batch-\d{3}\.json$/i.test(n)).sort();
const rows=[];
const errors=[];
const sourceRefPattern=/(doi\s*:|https?:\/\/|\b(?:19|20)\d{2}\b|\bV\d{1,2}-SRC-\d{3}\b|\bTHC\b.*source)/i;

for(const file of files){
  const batch=JSON.parse(fs.readFileSync(path.join(batchDir,file),'utf8'));
  for(const item of batch.items||[]){
    const checks={
      lessonId:/^THC-ENC-\d{3}$/.test(item.lessonId||''),
      targetPath:String(item.targetRepositoryPath||'').startsWith('site/wordpress/assets/infographics/') && /\.png$/i.test(item.targetRepositoryPath||''),
      altText:String(item.altTextDraft||'').trim().length>=40 && String(item.altTextDraft||'').trim().length<=320,
      caption:String(item.captionDraft||'').trim().length>=40,
      requiredLabels:Array.isArray(item.requiredLabels)&&item.requiredLabels.length>=4&&new Set(item.requiredLabels.map(String)).size===item.requiredLabels.length,
      accuracyRequirements:Array.isArray(item.accuracyRequirements)&&item.accuracyRequirements.length>=2&&item.accuracyRequirements.every(x=>String(x).trim().length>=80),
      misconceptionGuards:Array.isArray(item.misconceptionGuards)&&item.misconceptionGuards.length>=2&&item.misconceptionGuards.every(x=>String(x).trim().length>=25),
      sourceAnchors:Array.isArray(item.sourceAnchors)&&item.sourceAnchors.length>=2&&item.sourceAnchors.every(x=>String(x).trim().length>=8),
      sourceTraceabilityHeuristic:Array.isArray(item.sourceAnchors)&&item.sourceAnchors.every(x=>sourceRefPattern.test(String(x))),
      reviewBoundary:Object.values(item.requiredReviews||{}).every(x=>x==='pending')
    };
    const passed=Object.values(checks).every(Boolean);
    if(!passed) errors.push(...Object.entries(checks).filter(([,ok])=>!ok).map(([name])=>`${item.lessonId}: ${name}`));
    rows.push({
      lessonId:item.lessonId,
      batchId:batch.batchId,
      title:item.title,
      visualFamily:item.visualFamily,
      targetRepositoryPath:item.targetRepositoryPath,
      machineChecks:checks,
      machinePreflightPassed:passed,
      independentReviewRequired:true,
      independentReviewDecision:null,
      publicationApproved:false
    });
  }
}

const duplicateTargets=rows.map(x=>x.targetRepositoryPath).filter((v,i,a)=>a.indexOf(v)!==i);
for(const target of duplicateTargets) errors.push(`duplicate target path: ${target}`);
const output={
  schemaVersion:'1.0.0',
  artifactId:'thc-encyclopedia-visual-machine-preflight',
  generatedBy:'scripts/build-encyclopedia-visual-machine-preflight.mjs',
  boundary:'Machine checks validate structure, traceability signals, accessibility metadata presence, and review-state safety. They never grant scientific accuracy, rights clearance, independent review, or publication approval.',
  summary:{
    batchCount:files.length,
    candidateCount:rows.length,
    machinePreflightPassed:rows.filter(x=>x.machinePreflightPassed).length,
    machinePreflightFailed:rows.filter(x=>!x.machinePreflightPassed).length,
    independentlyApproved:0,
    publicationApproved:0
  },
  errors,
  candidates:rows
};
fs.mkdirSync(path.dirname(outPath),{recursive:true});
fs.writeFileSync(outPath,JSON.stringify(output,null,2)+'\n');
console.log(JSON.stringify(output.summary,null,2));
if(errors.length){
  console.error(`Machine visual preflight failed with ${errors.length} issue(s):`);
  for(const error of errors.slice(0,160)) console.error(' - '+error);
  process.exit(1);
}
console.log('Machine visual preflight PASS: all candidates structurally ready for independent review; none auto-approved.');
