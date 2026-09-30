#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';

const root=process.cwd();
const queuePath=path.join(root,'site/wordpress/education/encyclopedia-worked-example-review-queue.json');
const examplesPath=path.join(root,'content/encyclopedia/worked-examples-v1.json');
const queue=JSON.parse(fs.readFileSync(queuePath,'utf8'));
const examples=JSON.parse(fs.readFileSync(examplesPath,'utf8'));
const errors=[];
const exampleMap=new Map((examples.examples||[]).map(x=>[x.lessonId,x]));
const requiredChecks=['scientificClaimReview','sourceAnchorReview','measurementLogicReview','uncertaintyBoundaryReview','instructionalClarityReview','safetyLegalBoundaryReview','publicCopyReview'];
const allowed=new Set(queue.statusValues||[]);
const seen=new Set();

if(queue.schemaVersion!==1) errors.push('review queue schemaVersion must be 1');
if((queue.items||[]).length!==exampleMap.size) errors.push(`queue/example count mismatch: queue=${queue.items?.length||0}, examples=${exampleMap.size}`);

for(const item of queue.items||[]){
  if(seen.has(item.lessonId)) errors.push(`${item.lessonId}: duplicate queue item`);
  seen.add(item.lessonId);
  const ex=exampleMap.get(item.lessonId);
  if(!ex) errors.push(`${item.lessonId}: queue item has no worked example`);
  if(!allowed.has(item.status)) errors.push(`${item.lessonId}: invalid queue status ${item.status}`);
  if(!Number.isInteger(item.priority)||item.priority<1||item.priority>5) errors.push(`${item.lessonId}: priority must be integer 1-5`);
  for(const key of requiredChecks) if(typeof item.review?.[key]!=='boolean') errors.push(`${item.lessonId}: review.${key} must be boolean`);

  const allChecks=requiredChecks.every(k=>item.review?.[k]===true);
  const metadataComplete=typeof item.reviewer==='string'&&item.reviewer.trim().length>=2
    && typeof item.reviewedAt==='string'&&item.reviewedAt.length>=10
    && typeof item.decisionNotes==='string'&&item.decisionNotes.trim().length>=20;

  if(item.status==='approved' && (!allChecks||!metadataComplete)){
    errors.push(`${item.lessonId}: approved queue item requires every checklist gate plus reviewer/date/decision notes`);
  }
  if(item.status!=='approved' && ex?.learnerFacingApproved===true){
    errors.push(`${item.lessonId}: learnerFacingApproved=true while review queue status is ${item.status}`);
  }
  if(ex?.learnerFacingApproved===true){
    const rc=ex.reviewControl||{};
    if(item.status!=='approved') errors.push(`${item.lessonId}: public example requires approved queue status`);
    if(rc.independentReviewStatus!=='approved') errors.push(`${item.lessonId}: public example requires approved independent review`);
    if(!metadataComplete) errors.push(`${item.lessonId}: public example requires complete queue decision metadata`);
    if(rc.approvedBy!==item.reviewer) errors.push(`${item.lessonId}: approver mismatch between example and review queue`);
    if(rc.approvedForLearnerFacingAt!==item.reviewedAt) errors.push(`${item.lessonId}: approval-date mismatch between example and review queue`);
  }
}

for(const id of exampleMap.keys()) if(!seen.has(id)) errors.push(`${id}: worked example missing from review queue`);

if(errors.length){
  console.error(`Worked-example review queue validation failed with ${errors.length} issue(s):`);
  for(const e of errors) console.error(' - '+e);
  process.exit(1);
}
const counts={};
for(const item of queue.items||[]) counts[item.status]=(counts[item.status]||0)+1;
console.log(`Worked-example review queue PASS: ${queue.items.length} items; ${Object.entries(counts).map(([k,v])=>k+'='+v).join(', ')}.`);
