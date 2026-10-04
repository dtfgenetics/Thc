#!/usr/bin/env node
import fs from 'node:fs';
import { loadEncyclopediaRegistry } from './lib/encyclopedia-registry.mjs';

const file='data/encyclopedia-independent-review-manifest.json';
if(!fs.existsSync(file)){
  console.error('Missing '+file);
  process.exit(1);
}
const data=JSON.parse(fs.readFileSync(file,'utf8'));
const registryState=loadEncyclopediaRegistry(process.cwd());
const rows=Array.isArray(data.lessons)?data.lessons:[];
const errors=[];
if(rows.length!==registryState.totalCount) errors.push(`Expected ${registryState.totalCount} review rows; found ${rows.length}`);
if(new Set(rows.map(x=>x.lessonId)).size!==rows.length) errors.push('Review rows must have unique lesson IDs.');

for(let i=0;i<rows.length;i++){
  const row=rows[i];
  const expected=registryState.entries[i]?.id;
  if(row.lessonId!==expected) errors.push('Row '+(i+1)+' expected '+expected+'; found '+(row.lessonId||'(missing)'));
  for(const [name,task] of Object.entries(row.reviewTasks||{})){
    if(task.reviewerDecision!==null||task.reviewerId!==null||task.reviewedAt!==null||task.reviewNotes!==null){
      errors.push(row.lessonId+': generated '+name+' task must not synthesize reviewer evidence or decisions.');
    }
  }
  if(row.reviewTasks?.assessmentRationales?.required!==true) errors.push(row.lessonId+': rationale independent review must remain required.');
  if(row.reviewTasks?.teachingVisual?.required!==true) errors.push(row.lessonId+': visual review must remain required.');
  if(row.reviewTasks?.claimEvidence?.required!==true) errors.push(row.lessonId+': claim-evidence review must remain required.');
}

const summary=data.summary||{};
if(Number(summary.generatedReviewerDecisions)!==0) errors.push('Generated reviewer decision count must remain zero.');
if(Number(summary.lessonCount)!==rows.length) errors.push('Summary lessonCount mismatch.');
if(Number(summary.evidenceMapped)!==rows.filter(x=>x.reviewTasks?.claimEvidence?.mapped).length) errors.push('Summary evidenceMapped mismatch.');
if(Number(summary.visualCandidatesPresent)!==rows.filter(x=>Number(x.reviewTasks?.teachingVisual?.candidateCount||0)>0).length) errors.push('Summary visualCandidatesPresent mismatch.');

if(errors.length){
  console.error('Independent-review manifest validation failed with '+errors.length+' issue(s):');
  for(const error of errors.slice(0,160)) console.error(' - '+error);
  process.exit(1);
}
console.log(`Independent-review manifest PASS: ${registryState.totalCount} lessons enumerated; no reviewer decisions were synthesized.`);
