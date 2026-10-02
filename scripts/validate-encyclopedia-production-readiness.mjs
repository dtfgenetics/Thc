#!/usr/bin/env node
import fs from 'node:fs';

const file='data/encyclopedia-production-readiness.json';
if(!fs.existsSync(file)){
  console.error('Missing '+file);
  process.exit(1);
}
const data=JSON.parse(fs.readFileSync(file,'utf8'));
const rows=Array.isArray(data.lessons)?data.lessons:[];
const errors=[];

if(rows.length!==420) errors.push('Expected 420 lessons; found '+rows.length);
const seen=new Set();
for(let i=0;i<rows.length;i++){
  const row=rows[i];
  const expected='THC-ENC-'+String(i+1).padStart(3,'0');
  if(row.id!==expected) errors.push('Row '+(i+1)+' expected '+expected+'; found '+(row.id||'(missing)'));
  if(seen.has(row.id)) errors.push('Duplicate lesson '+row.id);
  seen.add(row.id);
  if(row.optionalLinks?.coursesRequired!==false) errors.push(row.id+': course membership must not be required');
  if(!Array.isArray(row.blockers)) errors.push(row.id+': blockers must be an array');
  if(row.state==='release_ready' && row.blockers.length) errors.push(row.id+': release_ready has blockers');
  if(row.state==='release_ready' && !row.publication?.authorized) errors.push(row.id+': release_ready without publication authorization');
  if(row.visual?.approved && !row.visual?.approvedAssetId) errors.push(row.id+': approved visual missing asset id');
  if(row.assessment?.reviewed && !['approved','independent_review_complete'].includes(row.assessment.reviewState)) errors.push(row.id+': assessment review state mismatch');
}

const strict=process.argv.includes('--strict');
if(strict){
  const notReady=rows.filter(x=>x.state!=='release_ready');
  if(notReady.length) errors.push(notReady.length+' lesson(s) are not release_ready');
}

if(errors.length){
  console.error('Encyclopedia production readiness validation failed with '+errors.length+' issue(s):');
  for(const error of errors.slice(0,200)) console.error(' - '+error);
  process.exit(1);
}

console.log('Encyclopedia production readiness PASS: 420 unique controlled lessons; course separation preserved'+(strict?' · strict release-ready gate passed':'')+'.');
