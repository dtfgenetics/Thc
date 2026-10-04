#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import { buildLessonAnswerRationalesV1 } from './lib/encyclopedia-assessment-v2.mjs';
import { readCanonicalEncyclopediaLessons } from './lib/encyclopedia-canonical-lessons.mjs';
import { loadEncyclopediaRegistry } from './lib/encyclopedia-registry.mjs';

const root=process.cwd();
const lessons=readCanonicalEncyclopediaLessons(root);
const registryState=loadEncyclopediaRegistry(root);
const errors=[], seen=new Set();
if(lessons.length!==registryState.totalCount) errors.push(`Expected ${registryState.totalCount} registered lessons; found ${lessons.length}`);
for(const lesson of lessons){
  const r=buildLessonAnswerRationalesV1(lesson);
  if(!r.lessonId||seen.has(r.lessonId)) errors.push(`Invalid/duplicate rationale lesson id: ${r.lessonId}`);
  seen.add(r.lessonId);
  if(r.schemaVersion!==1) errors.push(`${r.lessonId}: schemaVersion must be 1`);
  if(r.status!=='source-grounded-learner-facing') errors.push(`${r.lessonId}: rationale status must be source-grounded-learner-facing`);
  if(!Array.isArray(r.rationales)||r.rationales.length!==3) errors.push(`${r.lessonId}: exactly 3 rationales required`);
  for(const [i,x] of (r.rationales||[]).entries()){
    if(x.promptIndex!==i) errors.push(`${r.lessonId}: rationale ${i} promptIndex mismatch`);
    if(String(x.title||'').length<8) errors.push(`${r.lessonId}: rationale ${i} title too thin`);
    if(!Array.isArray(x.points)||x.points.length<4) errors.push(`${r.lessonId}: rationale ${i} needs at least 4 explanation points`);
    if((x.points||[]).some(p=>String(p).trim().length<40)) errors.push(`${r.lessonId}: rationale ${i} contains thin explanation point`);
  }
}
if(errors.length){
 console.error(`Answer-rationale validation failed with ${errors.length} issue(s):`);
 errors.slice(0,200).forEach(e=>console.error(' - '+e));
 process.exit(1);
}
console.log(`Encyclopedia answer rationales PASS: ${lessons.length}/${registryState.totalCount} lessons have three source-grounded learner-facing explanation sets.`);
