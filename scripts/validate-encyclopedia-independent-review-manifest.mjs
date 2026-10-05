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

const visualLedgerFile='data/encyclopedia-visual-review-ledger.json';
const visualLedger=fs.existsSync(visualLedgerFile)
  ? JSON.parse(fs.readFileSync(visualLedgerFile,'utf8'))
  : {lessons:[]};
const visualLedgerById=new Map((Array.isArray(visualLedger.lessons)?visualLedger.lessons:[]).map(row=>[row.lessonId,row]));

const sameJson=(a,b)=>JSON.stringify(a??null)===JSON.stringify(b??null);
const hasReviewerEvidence=task=>
  task?.reviewerDecision!==null||
  task?.reviewerId!==null||
  task?.reviewedAt!==null||
  task?.reviewNotes!==null||
  task?.reviewerName!==null||
  task?.reviewChecks!==null||
  task?.reviewSourcePacket!==null;

if(rows.length!==registryState.totalCount) errors.push(`Expected ${registryState.totalCount} review rows; found ${rows.length}`);
if(new Set(rows.map(x=>x.lessonId)).size!==rows.length) errors.push('Review rows must have unique lesson IDs.');

for(let i=0;i<rows.length;i++){
  const row=rows[i];
  const expected=registryState.entries[i]?.id;
  if(row.lessonId!==expected) errors.push('Row '+(i+1)+' expected '+expected+'; found '+(row.lessonId||'(missing)'));

  for(const [name,task] of Object.entries(row.reviewTasks||{})){
    if(name!=='teachingVisual'){
      if(hasReviewerEvidence(task)){
        errors.push(row.lessonId+': generated '+name+' task must not synthesize reviewer evidence or decisions.');
      }
      continue;
    }

    const ledgerRow=visualLedgerById.get(row.lessonId)||null;
    const manifestHasEvidence=hasReviewerEvidence(task);
    const ledgerHasEvidence=Boolean(ledgerRow?.decision);

    if(manifestHasEvidence&&!ledgerHasEvidence){
      errors.push(row.lessonId+': teachingVisual reviewer evidence is present without a validated visual-review ledger decision.');
      continue;
    }
    if(!manifestHasEvidence&&ledgerHasEvidence){
      errors.push(row.lessonId+': validated visual-review ledger decision was not projected into the independent-review manifest.');
      continue;
    }
    if(manifestHasEvidence&&ledgerHasEvidence){
      if(task.reviewerDecision!==ledgerRow.decision) errors.push(row.lessonId+': visual reviewerDecision does not match visual-review ledger.');
      if(task.reviewerId!==ledgerRow.reviewerId) errors.push(row.lessonId+': visual reviewerId does not match visual-review ledger.');
      if(task.reviewerName!==ledgerRow.reviewerName) errors.push(row.lessonId+': visual reviewerName does not match visual-review ledger.');
      if(task.reviewedAt!==ledgerRow.reviewedAt) errors.push(row.lessonId+': visual reviewedAt does not match visual-review ledger.');
      if(task.reviewNotes!==ledgerRow.reviewNotes) errors.push(row.lessonId+': visual reviewNotes do not match visual-review ledger.');
      if(task.reviewSourcePacket!==ledgerRow.sourcePacket) errors.push(row.lessonId+': visual reviewSourcePacket does not match visual-review ledger.');
      if(!sameJson(task.reviewChecks,ledgerRow.checks)) errors.push(row.lessonId+': visual reviewChecks do not match visual-review ledger.');
    }
  }

  if(row.reviewTasks?.assessmentRationales?.required!==true) errors.push(row.lessonId+': rationale independent review must remain required.');
  if(row.reviewTasks?.teachingVisual?.required!==true) errors.push(row.lessonId+': visual review must remain required.');
  if(row.reviewTasks?.claimEvidence?.required!==true) errors.push(row.lessonId+': claim-evidence review must remain required.');
}

const summary=data.summary||{};
const importedVisualDecisions=rows.filter(x=>Boolean(x.reviewTasks?.teachingVisual?.reviewerDecision)).length;
const importedVisualApprovals=rows.filter(x=>x.reviewTasks?.teachingVisual?.reviewerDecision==='approved').length;
const ledgerDecisions=[...visualLedgerById.values()].filter(x=>Boolean(x.decision)).length;
const ledgerApprovals=[...visualLedgerById.values()].filter(x=>x.decision==='approved').length;

if(Number(summary.generatedReviewerDecisions)!==0) errors.push('Generated reviewer decision count must remain zero.');
if(Number(summary.lessonCount)!==rows.length) errors.push('Summary lessonCount mismatch.');
if(Number(summary.evidenceMapped)!==rows.filter(x=>x.reviewTasks?.claimEvidence?.mapped).length) errors.push('Summary evidenceMapped mismatch.');
if(Number(summary.visualCandidatesPresent)!==rows.filter(x=>Number(x.reviewTasks?.teachingVisual?.candidateCount||0)>0).length) errors.push('Summary visualCandidatesPresent mismatch.');
if(Number(summary.importedVisualReviewerDecisions||0)!==importedVisualDecisions) errors.push('Summary importedVisualReviewerDecisions mismatch.');
if(Number(summary.importedVisualApprovals||0)!==importedVisualApprovals) errors.push('Summary importedVisualApprovals mismatch.');
if(importedVisualDecisions!==ledgerDecisions) errors.push('Projected visual reviewer decision count does not match validated visual-review ledger.');
if(importedVisualApprovals!==ledgerApprovals) errors.push('Projected visual approval count does not match validated visual-review ledger.');

if(errors.length){
  console.error('Independent-review manifest validation failed with '+errors.length+' issue(s):');
  for(const error of errors.slice(0,160)) console.error(' - '+error);
  process.exit(1);
}
console.log(`Independent-review manifest PASS: ${registryState.totalCount} lessons enumerated; generated reviewer decisions remain zero and imported visual decisions match the validated ledger.`);
