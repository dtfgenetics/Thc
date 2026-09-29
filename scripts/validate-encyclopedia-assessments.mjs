#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';

const root=process.cwd();
const encRoot=path.join(root,'content','encyclopedia');
const errors=[];
const warnings=[];
const promptOwners=new Map();
const lessons=[];

const normalize=s=>String(s||'').toLowerCase().replace(/\s+/g,' ').trim();

for(let vol=18;vol<=21;vol++){
  const dir=path.join(encRoot,`volume-${String(vol).padStart(2,'0')}`);
  for(const name of fs.readdirSync(dir).filter(n=>/^draft-lessons-\d{3}-\d{3}\.json$/.test(n)).sort()){
    const data=JSON.parse(fs.readFileSync(path.join(dir,name),'utf8'));
    for(const lesson of data.lessons||[]) lessons.push({vol,file:name,...lesson});
  }
}

if(lessons.length!==80) errors.push(`Expected 80 draft lessons across Volumes 18-21; found ${lessons.length}`);

for(const lesson of lessons){
  const id=lesson.id||`V${lesson.vol}:${lesson.number}`;
  if(!Array.isArray(lesson.knowledgeCheck)||lesson.knowledgeCheck.length<3) errors.push(`${id}: needs at least 3 lesson-specific knowledge checks`);
  if(lesson.assessmentDesign?.version!==2) errors.push(`${id}: assessmentDesign.version must be 2`);
  if(lesson.assessmentDesign?.answerRationaleStatus!=='pending_independent_review') errors.push(`${id}: answer rationale status must remain review-controlled`);
  const qs=lesson.knowledgeCheck||[];
  if(qs[0] && !normalize(qs[0]).includes(normalize(lesson.title))) errors.push(`${id}: first check must explicitly name the lesson topic`);
  if(qs[1] && !(lesson.misconceptions||[]).some(m=>normalize(qs[1]).includes(normalize(m)))) errors.push(`${id}: misconception challenge must use a lesson-specific misconception`);
  if(qs[2] && !normalize(qs[2]).startsWith('applied case')) errors.push(`${id}: third check must be an applied case`);
  for(const q of qs){
    const n=normalize(q);
    if(n.length<80) errors.push(`${id}: assessment prompt is too thin`);
    if(!promptOwners.has(n)) promptOwners.set(n,[]);
    promptOwners.get(n).push(id);
  }
}

for(const [prompt,owners] of promptOwners){
  if(owners.length>1) errors.push(`Duplicated knowledge-check prompt across lessons ${owners.join(', ')}: "${prompt.slice(0,120)}..."`);
}

const genericFragments=[
  'which observations and measurements would distinguish the main mechanisms described in this lesson',
  'which observations, progeny, markers, environments, or measurements would distinguish the main genetic explanations in this lesson',
  'which measurement, sample, design, or evidence record would be required before accepting the main conclusion of this lesson'
];
for(const lesson of lessons){
  for(const q of lesson.knowledgeCheck||[]){
    const n=normalize(q);
    for(const fragment of genericFragments) if(n.includes(fragment)) errors.push(`${lesson.id}: legacy generic assessment prompt remains`);
  }
}

if(errors.length){
  console.error(`Encyclopedia assessment validation failed with ${errors.length} issue(s):`);
  for(const e of errors) console.error(' - '+e);
  process.exit(1);
}
for(const w of warnings) console.warn('WARN: '+w);
console.log(`Encyclopedia assessment PASS: ${lessons.length} draft lessons across Volumes 18-21 have unique, lesson-specific mechanism/workflow, misconception, and applied-verification checks.`);
