#!/usr/bin/env node
import fs from 'node:fs';

const file='data/encyclopedia-unmapped-evidence-review-packets.json';
const errors=[];
if(!fs.existsSync(file)){
  console.error('Missing '+file);
  process.exit(1);
}
const data=JSON.parse(fs.readFileSync(file,'utf8'));
const packets=Array.isArray(data.packets)?data.packets:[];

if(data.artifactId!=='thc-encyclopedia-unmapped-evidence-review-packets') errors.push('artifactId mismatch');
if(!packets.length) errors.push('No unmapped evidence packets generated');
if(Number(data.summary?.unmappedLessons)!==packets.length) errors.push('summary unmappedLessons stale');
if(Number(data.summary?.generatedReviewerDecisions)!==0) errors.push('generated reviewer decisions must remain zero');
if(new Set(packets.map(row=>row.lessonId)).size!==packets.length) errors.push('lesson packets must be unique');

for(let i=0;i<packets.length;i++){
  const row=packets[i];
  if(row.rank!==i+1) errors.push('rank mismatch at '+(i+1));
  if(i>0&&Number(packets[i-1].evidencePriorityScore||0)<Number(row.evidencePriorityScore||0)) errors.push('priority ordering broken at '+(i+1));
  if(!/^THC-ENC-\d{3}$/.test(String(row.lessonId||''))) errors.push('invalid lessonId '+row.lessonId);
  if(row.lessonReviewDecision!==null||row.reviewerId!==null||row.reviewedAt!==null) errors.push(row.lessonId+': generated packet must not synthesize reviewer decisions');
  if(row.publicationEffect!=='none') errors.push(row.lessonId+': publicationEffect must remain none');
  if(!Array.isArray(row.claims)||!row.claims.length) errors.push(row.lessonId+': claims missing');
  if(!Array.isArray(row.sourceOptions)||!row.sourceOptions.length) errors.push(row.lessonId+': source options missing');
  const sourceKeys=new Set(row.sourceOptions.map(source=>source.sourceOptionKey));
  if(sourceKeys.size!==row.sourceOptions.length) errors.push(row.lessonId+': source options must be deduplicated');
  for(const source of row.sourceOptions){
    if(!source.sourceOptionKey) errors.push(row.lessonId+': source option key missing');
    if(source.traceable!==true) errors.push(row.lessonId+': reviewer packet source option must be traceable');
    for(const locator of source.directLocators||[]) if(!/^https:\/\//.test(String(locator))) errors.push(row.lessonId+': non-HTTPS direct locator');
  }
  for(const claim of row.claims){
    if(claim.mappingDecision!==null||claim.reviewerNotes!==null) errors.push(claim.candidateId+': generated claim decision/notes must remain null');
    if(claim.reviewState!=='pending_independent_science_review') errors.push(claim.candidateId+': review state must remain pending');
    if(!Array.isArray(claim.candidateSourceOptionKeys)||!claim.candidateSourceOptionKeys.length) errors.push(claim.candidateId+': no candidate source options');
    for(const key of claim.candidateSourceOptionKeys) if(!sourceKeys.has(key)) errors.push(claim.candidateId+': unknown source option '+key);
    if(Array.isArray(claim.selectedSourceOptionKeys)&&claim.selectedSourceOptionKeys.length) errors.push(claim.candidateId+': generated packet must not select sources');
  }
}

const reviewReady=packets.filter(row=>row.reviewReady).length;
if(Number(data.summary?.reviewReady)!==reviewReady) errors.push('summary reviewReady stale');
if(Number(data.summary?.notReviewReady)!==packets.length-reviewReady) errors.push('summary notReviewReady stale');

if(errors.length){
  console.error('Unmapped evidence review packet validation failed with '+errors.length+' issue(s):');
  for(const error of errors.slice(0,120)) console.error(' - '+error);
  process.exit(1);
}
console.log('Unmapped evidence review packets PASS: '+packets.length+' lessons queued with traceable candidate sources and no synthesized reviewer decisions.');
