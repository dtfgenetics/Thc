#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';

const root=process.cwd();
const queue=JSON.parse(fs.readFileSync(path.join(root,'site/wordpress/education/worked-example-visual-production-queue-v1.json'),'utf8'));
const briefs=JSON.parse(fs.readFileSync(path.join(root,'site/wordpress/education/visual-art-briefs/worked-examples-v1.json'),'utf8'));
const examples=JSON.parse(fs.readFileSync(path.join(root,'content/encyclopedia/worked-examples-v1.json'),'utf8'));
const errors=[];
const briefMap=new Map((briefs.briefs||[]).map(x=>[x.id,x]));
const exMap=new Map((examples.examples||[]).map(x=>[x.lessonId,x]));
const seen=new Set();
const allowed=new Set(queue.statusValues||[]);
const checks=['scientificQA','visualQA','labelSpellingQA','accessibilityQA','mobileQA','placementQA'];

if(queue.schemaVersion!==1) errors.push('visual production queue schemaVersion must be 1');
if((queue.items||[]).length!==briefMap.size) errors.push(`queue/brief count mismatch: queue=${queue.items?.length||0}, briefs=${briefMap.size}`);

for(const item of queue.items||[]){
  if(seen.has(item.visualId)) errors.push(`${item.visualId}: duplicate queue item`);
  seen.add(item.visualId);
  const brief=briefMap.get(item.visualId);
  if(!brief) errors.push(`${item.visualId}: queue item has no visual brief`);
  if(!exMap.has(item.lessonId)) errors.push(`${item.visualId}: lesson has no worked example`);
  if(brief && brief.lessonId!==item.lessonId) errors.push(`${item.visualId}: lesson mismatch between brief and queue`);
  if(!allowed.has(item.status)) errors.push(`${item.visualId}: invalid status ${item.status}`);
  if(!Number.isInteger(item.priority)||item.priority<1||item.priority>5) errors.push(`${item.visualId}: priority must be integer 1-5`);
  if(String(item.altText||'').length<80) errors.push(`${item.visualId}: altText too thin`);
  if(String(item.caption||'').length<70) errors.push(`${item.visualId}: caption too thin`);
  for(const key of checks) if(typeof item.review?.[key]!=='boolean') errors.push(`${item.visualId}: review.${key} must be boolean`);
  const allChecks=checks.every(k=>item.review?.[k]===true);
  const metadataComplete=typeof item.reviewer==='string'&&item.reviewer.trim().length>=2
    && typeof item.reviewedAt==='string'&&item.reviewedAt.length>=10;
  if(['approved','published'].includes(item.status)){
    if(!allChecks) errors.push(`${item.visualId}: ${item.status} requires all visual QA checks`);
    if(!metadataComplete) errors.push(`${item.visualId}: ${item.status} requires reviewer and review date`);
    if(typeof item.approvedMediaSlug!=='string'||item.approvedMediaSlug.trim().length<2) errors.push(`${item.visualId}: ${item.status} requires approvedMediaSlug`);
  }
  if(item.status==='artwork-needed' && checks.some(k=>item.review?.[k]===true)) errors.push(`${item.visualId}: artwork-needed item cannot claim completed QA`);
}

for(const id of briefMap.keys()) if(!seen.has(id)) errors.push(`${id}: visual brief missing from production queue`);

if(errors.length){
  console.error(`Worked-example visual production queue validation failed with ${errors.length} issue(s):`);
  for(const e of errors) console.error(' - '+e);
  process.exit(1);
}
const counts={};
for(const item of queue.items||[]) counts[item.status]=(counts[item.status]||0)+1;
console.log(`Worked-example visual queue PASS: ${queue.items.length} items; ${Object.entries(counts).map(([k,v])=>k+'='+v).join(', ')}.`);
