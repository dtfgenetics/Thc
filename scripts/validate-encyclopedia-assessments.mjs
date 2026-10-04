#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import { effectiveLessonAssessment } from './lib/encyclopedia-assessment-v2.mjs';
import { readCanonicalEncyclopediaLessons } from './lib/encyclopedia-canonical-lessons.mjs';
import { loadEncyclopediaRegistry } from './lib/encyclopedia-registry.mjs';

const root=process.cwd();
const encRoot=path.join(root,'content','encyclopedia');
const errors=[];
const lessons=readCanonicalEncyclopediaLessons(root);
const registryState=loadEncyclopediaRegistry(root);
const promptOwners=new Map();
const normalize=s=>String(s||'').toLowerCase().replace(/\s+/g,' ').trim();

if(lessons.length!==registryState.totalCount) errors.push(`Expected ${registryState.totalCount} registered encyclopedia lessons; found ${lessons.length}`);

for(const lesson of lessons){
  const id=lesson.id||`V${lesson.vol}:${lesson.number}`;
  const a=effectiveLessonAssessment(lesson);
  const qs=a.prompts||[];
  if(qs.length<3) errors.push(`${id}: needs at least 3 effective lesson-specific knowledge checks`);
  if(Number(a.version)!==2) errors.push(`${id}: effective assessment version must be 2`);
  if(qs[0] && !normalize(qs[0]).includes(normalize(lesson.title))) errors.push(`${id}: first check must explicitly name the lesson topic`);
  const misconceptions=Array.isArray(lesson.misconceptions)?lesson.misconceptions:[];
  if(qs[1] && misconceptions.length && !misconceptions.some(m=>normalize(qs[1]).includes(normalize(m)))) errors.push(`${id}: misconception challenge must use a lesson-specific misconception`);
  if(qs[2] && !normalize(qs[2]).startsWith('applied case')) errors.push(`${id}: third check must be an applied case`);
  for(const q of qs){
    const n=normalize(q);
    if(n.length<80) errors.push(`${id}: assessment prompt is too thin`);
    if(!promptOwners.has(n)) promptOwners.set(n,[]);
    promptOwners.get(n).push(id);
  }
}

for(const [prompt,owners] of promptOwners){
  if(owners.length>1) errors.push(`Duplicated assessment prompt across lessons ${owners.join(', ')}: "${prompt.slice(0,120)}..."`);
}

const genericFragments=[
  'which observations and measurements would distinguish the main mechanisms described in this lesson',
  'which observations, progeny, markers, environments, or measurements would distinguish the main genetic explanations in this lesson',
  'which measurement, sample, design, or evidence record would be required before accepting the main conclusion of this lesson'
];
for(const lesson of lessons){
  for(const q of effectiveLessonAssessment(lesson).prompts||[]){
    const n=normalize(q);
    for(const fragment of genericFragments) if(n.includes(fragment)) errors.push(`${lesson.id}: legacy generic assessment prompt remains`);
  }
}

if(errors.length){
  console.error(`Encyclopedia assessment validation failed with ${errors.length} issue(s):`);
  for(const e of errors.slice(0,200)) console.error(' - '+e);
  process.exit(1);
}
console.log(`Encyclopedia assessment PASS: ${lessons.length}/${registryState.totalCount} lessons have unique effective v2 reasoning, misconception, and applied-verification checks.`);
