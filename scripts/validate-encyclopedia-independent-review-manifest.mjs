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

const readLedger=(fileName,fallback)=>fs.existsSync(fileName)
  ? JSON.parse(fs.readFileSync(fileName,'utf8'))
  : fallback;

const visualLedger=readLedger('data/encyclopedia-visual-review-ledger.json',{lessons:[]});
const assessmentLedger=readLedger('data/encyclopedia-assessment-review-ledger.json',{lessons:[]});
const claimLedger=readLedger('data/encyclopedia-claim-review-ledger.json',{lessonSummary:{},summary:{}});

const byLesson=ledger=>new Map((Array.isArray(ledger.lessons)?ledger.lessons:[]).map(row=>[row.lessonId,row]));
const visualLedgerById=byLesson(visualLedger);
const assessmentLedgerById=byLesson(assessmentLedger);

const sameJson=(a,b)=>JSON.stringify(a??null)===JSON.stringify(b??null);
const hasReviewerEvidence=task=>
  task?.reviewerDecision!=null||
  task?.reviewerId!=null||
  task?.reviewedAt!=null||
  task?.reviewNotes!=null||
  task?.reviewerName!=null||
  task?.reviewChecks!=null;

const validateProjectedDecision=(lessonId,label,task,ledgerRow)=>{
  const manifestHasEvidence=hasReviewerEvidence(task);
  const ledgerHasEvidence=Boolean(ledgerRow?.decision);
  if(manifestHasEvidence&&!ledgerHasEvidence){
    errors.push(lessonId+': '+label+' reviewer evidence is present without a validated ledger decision.');
    return;
  }
  if(!manifestHasEvidence&&ledgerHasEvidence){
    errors.push(lessonId+': validated '+label+' ledger decision was not projected into the independent-review manifest.');
    return;
  }
  if(manifestHasEvidence&&ledgerHasEvidence){
    if(task.reviewerDecision!==ledgerRow.decision) errors.push(lessonId+': '+label+' reviewerDecision does not match ledger.');
    if(task.reviewerId!==ledgerRow.reviewerId) errors.push(lessonId+': '+label+' reviewerId does not match ledger.');
    if(task.reviewerName!==ledgerRow.reviewerName) errors.push(lessonId+': '+label+' reviewerName does not match ledger.');
    if(task.reviewedAt!==ledgerRow.reviewedAt) errors.push(lessonId+': '+label+' reviewedAt does not match ledger.');
    if(task.reviewNotes!==ledgerRow.reviewNotes) errors.push(lessonId+': '+label+' reviewNotes do not match ledger.');
    if(task.reviewSourcePacket!==ledgerRow.sourcePacket) errors.push(lessonId+': '+label+' reviewSourcePacket does not match ledger.');
    if(!sameJson(task.reviewChecks,ledgerRow.checks)) errors.push(lessonId+': '+label+' reviewChecks do not match ledger.');
  }
};

if(rows.length!==registryState.totalCount) errors.push(`Expected ${registryState.totalCount} review rows; found ${rows.length}`);
if(new Set(rows.map(x=>x.lessonId)).size!==rows.length) errors.push('Review rows must have unique lesson IDs.');

for(let i=0;i<rows.length;i++){
  const row=rows[i];
  const expected=registryState.entries[i]?.id;
  if(row.lessonId!==expected) errors.push('Row '+(i+1)+' expected '+expected+'; found '+(row.lessonId||'(missing)'));

  const claimTask=row.reviewTasks?.claimEvidence||{};
  if(hasReviewerEvidence(claimTask)){
    errors.push(row.lessonId+': claimEvidence task must not collapse claim-level reviews into synthetic lesson-level reviewer evidence.');
  }
  const expectedClaimSummary=claimLedger.lessonSummary?.[row.lessonId]||{claimCount:0,completed:0,approved:0,changesRequested:0,rejected:0};
  if(!sameJson(claimTask.claimReviewSummary,expectedClaimSummary)){
    errors.push(row.lessonId+': claimReviewSummary does not match claim-review ledger.');
  }

  validateProjectedDecision(
    row.lessonId,
    'assessment',
    row.reviewTasks?.assessmentRationales||{},
    assessmentLedgerById.get(row.lessonId)||null
  );
  validateProjectedDecision(
    row.lessonId,
    'visual',
    row.reviewTasks?.teachingVisual||{},
    visualLedgerById.get(row.lessonId)||null
  );

  const publicationTask=row.reviewTasks?.publication||{};
  if(hasReviewerEvidence(publicationTask)){
    errors.push(row.lessonId+': generated publication task must not synthesize reviewer evidence or decisions.');
  }

  if(row.reviewTasks?.assessmentRationales?.required!==true) errors.push(row.lessonId+': rationale independent review must remain required.');
  if(row.reviewTasks?.teachingVisual?.required!==true) errors.push(row.lessonId+': visual review must remain required.');
  if(row.reviewTasks?.claimEvidence?.required!==true) errors.push(row.lessonId+': claim-evidence review must remain required.');
}

const summary=data.summary||{};
const importedVisualDecisions=rows.filter(x=>Boolean(x.reviewTasks?.teachingVisual?.reviewerDecision)).length;
const importedVisualApprovals=rows.filter(x=>x.reviewTasks?.teachingVisual?.reviewerDecision==='approved').length;
const visualLedgerDecisions=[...visualLedgerById.values()].filter(x=>Boolean(x.decision)).length;
const visualLedgerApprovals=[...visualLedgerById.values()].filter(x=>x.decision==='approved').length;
const importedAssessmentDecisions=rows.filter(x=>Boolean(x.reviewTasks?.assessmentRationales?.reviewerDecision)).length;
const importedAssessmentApprovals=rows.filter(x=>x.reviewTasks?.assessmentRationales?.reviewerDecision==='approved').length;
const assessmentLedgerDecisions=[...assessmentLedgerById.values()].filter(x=>Boolean(x.decision)).length;
const assessmentLedgerApprovals=[...assessmentLedgerById.values()].filter(x=>x.decision==='approved').length;

if(Number(summary.generatedReviewerDecisions)!==0) errors.push('Generated reviewer decision count must remain zero.');
if(Number(summary.lessonCount)!==rows.length) errors.push('Summary lessonCount mismatch.');
if(Number(summary.evidenceMapped)!==rows.filter(x=>x.reviewTasks?.claimEvidence?.mapped).length) errors.push('Summary evidenceMapped mismatch.');
if(Number(summary.visualCandidatesPresent)!==rows.filter(x=>Number(x.reviewTasks?.teachingVisual?.candidateCount||0)>0).length) errors.push('Summary visualCandidatesPresent mismatch.');
if(Number(summary.importedVisualReviewerDecisions||0)!==importedVisualDecisions) errors.push('Summary importedVisualReviewerDecisions mismatch.');
if(Number(summary.importedVisualApprovals||0)!==importedVisualApprovals) errors.push('Summary importedVisualApprovals mismatch.');
if(importedVisualDecisions!==visualLedgerDecisions) errors.push('Projected visual reviewer decision count does not match validated visual-review ledger.');
if(importedVisualApprovals!==visualLedgerApprovals) errors.push('Projected visual approval count does not match validated visual-review ledger.');
if(Number(summary.importedAssessmentReviewerDecisions||0)!==importedAssessmentDecisions) errors.push('Summary importedAssessmentReviewerDecisions mismatch.');
if(Number(summary.importedAssessmentApprovals||0)!==importedAssessmentApprovals) errors.push('Summary importedAssessmentApprovals mismatch.');
if(importedAssessmentDecisions!==assessmentLedgerDecisions) errors.push('Projected assessment reviewer decision count does not match validated assessment-review ledger.');
if(importedAssessmentApprovals!==assessmentLedgerApprovals) errors.push('Projected assessment approval count does not match validated assessment-review ledger.');
if(Number(summary.reviewedClaimCandidates||0)!==Number(claimLedger.summary?.completed||0)) errors.push('Summary reviewedClaimCandidates mismatch.');
if(Number(summary.approvedClaimCandidates||0)!==Number(claimLedger.summary?.approved||0)) errors.push('Summary approvedClaimCandidates mismatch.');
if(Number(summary.totalClaimCandidates||0)!==Number(claimLedger.summary?.claimCount||0)) errors.push('Summary totalClaimCandidates mismatch.');

if(errors.length){
  console.error('Independent-review manifest validation failed with '+errors.length+' issue(s):');
  for(const error of errors.slice(0,200)) console.error(' - '+error);
  process.exit(1);
}
console.log(`Independent-review manifest PASS: ${registryState.totalCount} lessons enumerated; generated reviewer decisions remain zero, assessment/visual decisions match validated ledgers, and claim-review progress matches the claim ledger.`);
