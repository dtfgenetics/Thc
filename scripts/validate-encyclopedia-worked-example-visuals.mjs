#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';

const root=process.cwd();
const examples=JSON.parse(fs.readFileSync(path.join(root,'content/encyclopedia/worked-examples-v1.json'),'utf8'));
const briefs=JSON.parse(fs.readFileSync(path.join(root,'site/wordpress/education/visual-art-briefs/worked-examples-v1.json'),'utf8'));
const errors=[];
const exMap=new Map((examples.examples||[]).map(x=>[x.lessonId,x]));
const seen=new Set();

if(briefs.schemaVersion!==1) errors.push('worked-example visual brief schemaVersion must be 1');
if(!Array.isArray(briefs.briefs)||briefs.briefs.length!==exMap.size) errors.push(`Expected one visual brief for each worked example; briefs=${briefs.briefs?.length||0}, examples=${exMap.size}`);
if(!String(briefs.artDirection?.publicationPolicy||'').includes('artwork-needed')) errors.push('publicationPolicy must keep visuals blocked until QA');

for(const b of briefs.briefs||[]){
  if(seen.has(b.lessonId)) errors.push(`${b.lessonId}: duplicate visual brief`);
  seen.add(b.lessonId);
  const ex=exMap.get(b.lessonId);
  if(!ex) errors.push(`${b.lessonId}: visual brief has no worked example`);
  if(!/^THC-WE-VIS-\d{3}$/.test(String(b.id||''))) errors.push(`${b.lessonId}: invalid visual brief id ${b.id||'(missing)'}`);
  if(b.productionStatus!=='brief-approved-artwork-needed') errors.push(`${b.lessonId}: productionStatus must remain brief-approved-artwork-needed until artwork QA completes`);
  if(String(b.role||'').length<5) errors.push(`${b.lessonId}: visual role missing/thin`);
  if(String(b.primaryMessage||'').length<80) errors.push(`${b.lessonId}: primaryMessage too thin`);
  if(!Array.isArray(b.layout)||b.layout.length<4) errors.push(`${b.lessonId}: needs at least 4 layout requirements`);
  if(!Array.isArray(b.requiredLabels)||b.requiredLabels.length<6) errors.push(`${b.lessonId}: needs at least 6 required labels`);
  if(!Array.isArray(b.forbiddenClaims)||b.forbiddenClaims.length<3) errors.push(`${b.lessonId}: needs at least 3 forbidden claims`);
  if(String(b.altText||'').length<80) errors.push(`${b.lessonId}: alt text too thin`);
  if(String(b.caption||'').length<70) errors.push(`${b.lessonId}: caption too thin`);
  if(b.placement?.lessonId!==b.lessonId) errors.push(`${b.lessonId}: placement lessonId mismatch`);
  if(b.placement?.location!=='worked-example') errors.push(`${b.lessonId}: placement.location must be worked-example`);
  const q=b.qa||{};
  for(const key of ['scientific','visual','labels','accessibility','mobile','placement']){
    if(typeof q[key]!=='boolean') errors.push(`${b.lessonId}: qa.${key} must be boolean`);
  }
  if(Object.values(q).some(v=>v===true)) errors.push(`${b.lessonId}: new visual briefs must not falsely mark QA as complete`);
  const blob=JSON.stringify(b).toLowerCase();
  for(const banned of ['universal optimum','guaranteed yield','perfect vpd','best ppm']){
    if(blob.includes(banned)) errors.push(`${b.lessonId}: contains banned universal-prescription language "${banned}"`);
  }
}

for(const id of exMap.keys()) if(!seen.has(id)) errors.push(`${id}: worked example missing visual brief`);

if(errors.length){
  console.error(`Worked-example visual brief validation failed with ${errors.length} issue(s):`);
  for(const e of errors) console.error(' - '+e);
  process.exit(1);
}
console.log(`Worked-example visual briefs PASS: ${briefs.briefs.length}/${exMap.size} examples have a controlled production brief with placement, accessibility text, forbidden claims, and explicit QA state.`);
