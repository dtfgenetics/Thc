#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';

const root=process.cwd();
const registry=JSON.parse(fs.readFileSync(path.join(root,'content/encyclopedia/current-controlled-registry.json'),'utf8'));
const file=path.join(root,'content/encyclopedia/worked-examples-v1.json');
const data=JSON.parse(fs.readFileSync(file,'utf8'));
const errors=[];
const known=new Map((registry.entries||[]).map(x=>[x.id,x]));
const seen=new Set();

if(data.schemaVersion!==1) errors.push('worked examples schemaVersion must be 1');
if(data.status!=='controlled-instructional-examples-review-required') errors.push('worked examples must remain review-required');
if(!String(data.publicationRule||'').includes('not universal prescriptions')) errors.push('publicationRule must preserve non-prescriptive boundary');
if(!Array.isArray(data.examples)||data.examples.length<8) errors.push('expected at least 8 worked examples');

for(const ex of data.examples||[]){
  if(!known.has(ex.lessonId)) errors.push(`${ex.lessonId}: lesson ID not in controlled 420 registry`);
  if(seen.has(ex.lessonId)) errors.push(`${ex.lessonId}: duplicate worked example`);
  seen.add(ex.lessonId);
  if(String(ex.title||'').length<12) errors.push(`${ex.lessonId}: title too thin`);
  if(String(ex.scenario||'').length<80) errors.push(`${ex.lessonId}: scenario too thin`);
  if(!Array.isArray(ex.reasoningPath)||ex.reasoningPath.length<5) errors.push(`${ex.lessonId}: needs at least 5 reasoning steps`);
  if(!Array.isArray(ex.evidenceToCollect)||ex.evidenceToCollect.length<5) errors.push(`${ex.lessonId}: needs at least 5 evidence items`);
  if(!Array.isArray(ex.weakAnswerPatterns)||ex.weakAnswerPatterns.length<3) errors.push(`${ex.lessonId}: needs at least 3 weak-answer patterns`);
  if(String(ex.verification||'').length<100) errors.push(`${ex.lessonId}: verification too thin`);
  if(String(ex.boundary||'').length<100) errors.push(`${ex.lessonId}: applicability boundary too thin`);
  const blob=JSON.stringify(ex).toLowerCase();
  for(const banned of ['always use ', 'guaranteed yield', 'universal optimum', 'perfect vpd', 'best ppm']) {
    if(blob.includes(banned)) errors.push(`${ex.lessonId}: contains banned universal-prescription language "${banned}"`);
  }
}

const required=['THC-ENC-085','THC-ENC-106','THC-ENC-123','THC-ENC-261','THC-ENC-321','THC-ENC-385','THC-ENC-402','THC-ENC-404'];
for(const id of required) if(!seen.has(id)) errors.push(`missing required high-value worked example ${id}`);

if(errors.length){
  console.error(`Worked-example validation failed with ${errors.length} issue(s):`);
  for(const e of errors) console.error(' - '+e);
  process.exit(1);
}
console.log(`Worked examples PASS: ${data.examples.length} high-value lessons include reasoning, evidence, failure patterns, verification, and transfer limits.`);
