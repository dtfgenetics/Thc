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
if(data.status!=='source-grounded-instructional-examples') errors.push('worked examples status must be source-grounded-instructional-examples');
if(!String(data.publicationRule||'').includes('canonical lesson/source/evidence accuracy checks')) errors.push('publicationRule must require canonical accuracy checks');
if(!Array.isArray(data.examples)||data.examples.length<16) errors.push('expected at least 16 worked examples');

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
  if(typeof ex.learnerFacingEnabled!=='boolean') errors.push(`${ex.lessonId}: learnerFacingEnabled must be explicit boolean`);
  if(ex.learnerFacingEnabled!==true) errors.push(`${ex.lessonId}: source-grounded worked example should be learner-facing enabled`);
  if(ex.qualityControl?.accuracyStatus!=='source-grounded') errors.push(`${ex.lessonId}: qualityControl.accuracyStatus must be source-grounded`);
  if(String(ex.qualityControl?.basis||'').length<80) errors.push(`${ex.lessonId}: quality-control basis too thin`);
  const blob=JSON.stringify(ex).toLowerCase();
  for(const banned of ['always use ', 'guaranteed yield', 'universal optimum', 'perfect vpd', 'best ppm']) {
    if(blob.includes(banned)) errors.push(`${ex.lessonId}: contains banned universal-prescription language "${banned}"`);
  }
}

const required=['THC-ENC-049','THC-ENC-085','THC-ENC-092','THC-ENC-106','THC-ENC-123','THC-ENC-161','THC-ENC-261','THC-ENC-303','THC-ENC-321','THC-ENC-349','THC-ENC-385','THC-ENC-393','THC-ENC-402','THC-ENC-404','THC-ENC-416','THC-ENC-417'];
for(const id of required) if(!seen.has(id)) errors.push(`missing required high-value worked example ${id}`);

if(errors.length){
  console.error(`Worked-example validation failed with ${errors.length} issue(s):`);
  for(const e of errors) console.error(' - '+e);
  process.exit(1);
}
console.log(`Worked examples PASS: ${data.examples.length} source-grounded learner-facing examples include reasoning, evidence, failure patterns, verification, transfer limits, and accuracy metadata.`);
