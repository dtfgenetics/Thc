#!/usr/bin/env node
import fs from 'node:fs';

const file='data/encyclopedia-quality-scorecard.json';
if(!fs.existsSync(file)){
  console.error('Missing '+file+'. Run npm run build:encyclopedia-quality-scorecard.');
  process.exit(1);
}
const data=JSON.parse(fs.readFileSync(file,'utf8'));
const rows=Array.isArray(data.lessons)?data.lessons:[];
const queue=Array.isArray(data.repairQueue)?data.repairQueue:[];
const errors=[];

if(data.artifactId!=='thc-encyclopedia-quality-scorecard') errors.push('artifactId mismatch');
if(rows.length!==420) errors.push('Expected 420 lessons; found '+rows.length);
if(queue.length!==420) errors.push('Expected 420 repair queue rows; found '+queue.length);
if(new Set(rows.map(x=>x.id)).size!==rows.length) errors.push('Lesson IDs must be unique');
if(new Set(queue.map(x=>x.lessonId)).size!==queue.length) errors.push('Repair queue IDs must be unique');

for(let i=0;i<rows.length;i++){
  const row=rows[i];
  const expected='THC-ENC-'+String(i+1).padStart(3,'0');
  if(row.id!==expected) errors.push('Row '+(i+1)+' expected '+expected+'; found '+(row.id||'(missing)'));
  if(!Number.isFinite(row.score)||row.score<0||row.score>100) errors.push(row.id+': invalid score');
  if(!Array.isArray(row.dimensions)||row.dimensions.length!==8) errors.push(row.id+': expected 8 quality dimensions');
  if(!Array.isArray(row.blockers)||!Array.isArray(row.nextActions)) errors.push(row.id+': blockers/nextActions must be arrays');
  const release=row.dimensions?.find(x=>x.name==='release_control');
  if(release?.details?.publicationAuthorized===false&&release.score>=8) errors.push(row.id+': publication points awarded without authorization');
  const evidence=row.dimensions?.find(x=>x.name==='evidence');
  if(evidence?.details?.evidenceReviewed===false&&evidence.score>14) errors.push(row.id+': independent evidence-review points awarded before review');
  const assessment=row.dimensions?.find(x=>x.name==='assessment');
  if(assessment?.details?.rationaleReviewed===false&&assessment.score>7) errors.push(row.id+': assessment-review points awarded before review');
}

for(let i=0;i<queue.length;i++){
  const row=queue[i];
  if(row.rank!==i+1) errors.push('Repair queue rank mismatch at '+(i+1));
  if(i>0&&Number(queue[i-1].repairPriorityScore||0)<Number(row.repairPriorityScore||0)) errors.push('Repair queue is not priority-descending at rank '+(i+1));
}

const avg=Math.round(rows.reduce((n,x)=>n+x.score,0)/Math.max(1,rows.length));
if(Number(data.summary?.averageScore)!==avg) errors.push('Summary averageScore is stale');
const missingCounts={};
for(const row of rows) for(const key of row.missing||[]) missingCounts[key]=(missingCounts[key]||0)+1;
for(const [key,count] of Object.entries(missingCounts)){
  if(Number(data.summary?.missingDimensionCounts?.[key]||0)!==count) errors.push('Summary missing dimension count stale for '+key);
}

if(errors.length){
  console.error('Encyclopedia quality scorecard validation failed with '+errors.length+' issue(s):');
  for(const error of errors.slice(0,100)) console.error(' - '+error);
  process.exit(1);
}
console.log('Encyclopedia quality scorecard PASS: 420 lessons ranked without synthesizing review or publication approval.');
