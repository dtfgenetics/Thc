#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import { effectiveLessonAssessment } from './lib/encyclopedia-assessment-v2.mjs';
import { readCanonicalEncyclopediaLessons } from './lib/encyclopedia-canonical-lessons.mjs';

const root=process.cwd();
const strictQuality=process.argv.includes('--strict-quality');
const strictAssessment=process.argv.includes('--strict-assessment');
const registryPath=path.join(root,'content/encyclopedia/current-controlled-registry.json');
const registry=JSON.parse(fs.readFileSync(registryPath,'utf8'));
const expected=new Map((registry.entries||[]).map(e=>[e.id,e]));
const lessons=[];
const errors=[];
const warnings=[];
const assessmentMissing=[];
const qualityIssues=[];
const assert=(ok,msg)=>{if(!ok)errors.push(msg)};
const warn=(msg)=>warnings.push(msg);

const canonicalLessons=readCanonicalEncyclopediaLessons(root);
for(const lesson of canonicalLessons){
  lessons.push({...lesson,__path:lesson.__path,__volume:Number(lesson.__part)});
}

assert((registry.entries||[]).length===420,`Controlled registry must contain 420 entries; found ${registry.entries?.length||0}`);
assert(lessons.length===420,`Repository must resolve to exactly 420 lessons; found ${lessons.length}`);

const seen=new Set();
const routes=new Set();
const slugs=new Set();
const checkSignatures=new Map();

const len=(value)=>String(value||'').trim().length;
const arr=(value)=>Array.isArray(value)?value:[];
const terms=(lesson)=>arr(lesson.terms).length||arr(lesson.termsToKnow).length;

for(const lesson of lessons){
  const id=lesson.id;
  assert(/^THC-ENC-\d{3}$/.test(String(id||'')),`${lesson.__path}: invalid lesson id ${id||'(missing)'}`);
  assert(!seen.has(id),`Duplicate lesson id ${id}`);
  seen.add(id);
  const current=expected.get(id);
  assert(Boolean(current),`${lesson.__path}: ${id} not found in current controlled registry`);
  if(!current) continue;

  assert(Number(lesson.number)===current.number,`${id}: number mismatch; repo=${lesson.number}, controlled=${current.number}`);
  assert(lesson.__volume===current.part,`${id}: stored in volume ${lesson.__volume}, controlled part is ${current.part}`);
  assert(String(lesson.title||'')===current.title,`${id}: title mismatch; repo="${lesson.title||''}", controlled="${current.title}"`);

  if(current.part>=18){
    assert(String(lesson.primaryFormat||'')===current.primaryFormat,`${id}: primaryFormat mismatch; repo="${lesson.primaryFormat||''}", controlled="${current.primaryFormat}"`);
    assert(String(lesson.requiredTeachingVisual||'')===current.teachingVisual,`${id}: teaching visual mismatch; repo="${lesson.requiredTeachingVisual||''}", controlled="${current.teachingVisual}"`);
  }

  if(lesson.route){
    assert(!routes.has(lesson.route),`${id}: duplicate route ${lesson.route}`);
    routes.add(lesson.route);
  } else qualityIssues.push(`${id}: route missing`);
  if(lesson.slug){
    assert(!slugs.has(lesson.slug),`${id}: duplicate slug ${lesson.slug}`);
    slugs.add(lesson.slug);
  } else qualityIssues.push(`${id}: slug missing`);

  if(len(lesson.objective)<60) qualityIssues.push(`${id}: objective is missing/thin`);
  if(terms(lesson)<4) qualityIssues.push(`${id}: needs at least 4 defined/key terms`);
  if(arr(lesson.coreScience).length<3) qualityIssues.push(`${id}: needs at least 3 core-science statements`);
  if(arr(lesson.cultivationRelevance).length<1) qualityIssues.push(`${id}: cultivation relevance missing`);
  if(arr(lesson.measureAndRecord).length<1) qualityIssues.push(`${id}: measure-and-record layer missing`);
  if(arr(lesson.misconceptions).length<2) qualityIssues.push(`${id}: needs at least 2 misconception checks`);
  if(arr(lesson.evidenceLimits).length<1) qualityIssues.push(`${id}: evidence limits missing`);
  if(arr(lesson.sourceNotes).length<2) qualityIssues.push(`${id}: needs at least 2 source notes`);
  if(len(lesson.crossLinks)<10) qualityIssues.push(`${id}: cross-links missing/thin`);

  const storedChecks=arr(lesson.knowledgeCheck);
  const derived=effectiveLessonAssessment(lesson);
  const checks=arr(derived.prompts);
  if(checks.length<3){
    assessmentMissing.push(id);
  } else {
    if(storedChecks.length<3 && current.part<=17) warnings.push(`${id}: assessment is generated at render/validation time from canonical lesson fields; stored knowledgeCheck not yet materialized`);
    const signature=checks.map(x=>String(x).toLowerCase().replace(/\s+/g,' ').trim()).join(' || ');
    const prior=checkSignatures.get(signature);
    if(prior) qualityIssues.push(`${id}: effective knowledge check duplicates ${prior}`);
    else checkSignatures.set(signature,id);
  }
}

for(const entry of registry.entries||[]){
  assert(seen.has(entry.id),`Controlled lesson missing from repository: ${entry.id} ${entry.title}`);
}

if(qualityIssues.length){
  const target=strictQuality?errors:warnings;
  for(const issue of qualityIssues) target.push(issue);
}
if(assessmentMissing.length){
  const msg=`${assessmentMissing.length} lessons lack 3 lesson-specific knowledge checks: ${assessmentMissing.slice(0,25).join(', ')}${assessmentMissing.length>25?' …':''}`;
  (strictAssessment?errors:warnings).push(msg);
}

if(errors.length){
  console.error(`Encyclopedia content-control validation failed with ${errors.length} error(s):`);
  for(const e of errors) console.error(' - '+e);
  if(warnings.length){
    console.error(`Warnings (${warnings.length}):`);
    for(const w of warnings.slice(0,80)) console.error(' - '+w);
  }
  process.exit(1);
}

console.log(`Encyclopedia content-control PASS: ${lessons.length}/420 controlled lessons resolve with unique IDs and current controlled titles.`);
console.log(`Assessment coverage: ${420-assessmentMissing.length}/420 lessons have at least 3 effective lesson-specific knowledge checks (stored or generated); ${assessmentMissing.length} remain.`);
console.log(`Quality findings: ${qualityIssues.length} non-identity issue(s)${strictQuality?' (strict)':' (reported as warnings)'}.`);
if(warnings.length){
  console.warn(`Warnings (${warnings.length}):`);
  for(const w of warnings.slice(0,80)) console.warn(' - '+w);
}
