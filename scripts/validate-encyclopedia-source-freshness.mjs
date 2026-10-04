#!/usr/bin/env node
import fs from 'node:fs';

const file='data/encyclopedia-source-freshness.json';
const errors=[];
if(!fs.existsSync(file)){
  console.error('Missing '+file);
  process.exit(1);
}
const data=JSON.parse(fs.readFileSync(file,'utf8'));
const rows=Array.isArray(data.sources)?data.sources:[];
const queue=Array.isArray(data.revalidationQueue)?data.revalidationQueue:[];

if(data.artifactId!=='thc-encyclopedia-source-freshness') errors.push('artifactId mismatch');
if(!rows.length) errors.push('No source freshness rows found');
if(new Set(rows.map(x=>x.sourceId)).size!==rows.length) errors.push('source IDs must be unique');
for(const row of rows){
  if(!/^(?:ENC-AUTH-\d{3}|V\d{2}-SRC-\d{3})$/.test(String(row.sourceId||''))) errors.push('invalid sourceId '+row.sourceId);
  if(!['high','medium'].includes(row.volatility)) errors.push(row.sourceId+': invalid volatility');
  if(!Number.isFinite(row.reviewIntervalDays)||row.reviewIntervalDays<1) errors.push(row.sourceId+': invalid review interval');
  if(!['verification_date_missing','invalid_verification_date','overdue','due_soon','current'].includes(row.freshnessStatus)) errors.push(row.sourceId+': invalid freshnessStatus');
  if(row.freshnessStatus==='current'&&!row.lastVerifiedAt) errors.push(row.sourceId+': current source requires explicit lastVerifiedAt');
  if(row.reviewState!=='pending_explicit_source_revalidation') errors.push(row.sourceId+': review state must remain pending explicit revalidation');
  if(row.publicationEffect!=='none') errors.push(row.sourceId+': freshness audit must not alter publication state');
  if(row.retractionCheckRequired&&row.retractionStatus==='not_applicable') errors.push(row.sourceId+': peer-reviewed source cannot mark retraction not applicable');
  if(!Array.isArray(row.impactedLessonIds)) errors.push(row.sourceId+': impactedLessonIds must be an array');
}
const requires=rows.filter(x=>x.requiresRevalidation);
if(queue.length!==requires.length) errors.push('revalidation queue length mismatch');
for(let i=0;i<queue.length;i++){
  const row=queue[i];
  if(row.rank!==i+1) errors.push('queue rank mismatch at '+(i+1));
  if(i>0&&Number(queue[i-1].priorityScore||0)<Number(row.priorityScore||0)) errors.push('queue priority is not descending at '+(i+1));
}
const summary=data.summary||{};
if(Number(summary.sourceCount)!==rows.length) errors.push('summary sourceCount stale');
if(Number(summary.centralRegistrySources||0)+Number(summary.externalVolumeSources||0)!==rows.length) errors.push('summary central/external source accounting stale');
if(Number(summary.requiresRevalidation)!==requires.length) errors.push('summary requiresRevalidation stale');
if(Number(summary.verificationDateMissing)!==rows.filter(x=>x.freshnessStatus==='verification_date_missing').length) errors.push('summary verificationDateMissing stale');

if(errors.length){
  console.error('Encyclopedia source freshness validation failed with '+errors.length+' issue(s):');
  for(const error of errors.slice(0,100)) console.error(' - '+error);
  process.exit(1);
}
console.log('Encyclopedia source freshness PASS: '+rows.length+' central + volume authoritative sources tracked without synthesizing verification or retraction clearance.');
