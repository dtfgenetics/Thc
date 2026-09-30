#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';

const root=process.cwd();
const examples=JSON.parse(fs.readFileSync(path.join(root,'content/encyclopedia/worked-examples-v1.json'),'utf8'));
const errors=[];
const stop=new Set(['this','that','with','from','into','while','their','there','which','what','when','where','about','before','after','under','over','than','then','they','them','have','has','had','will','would','should','could','your','using','used','use','plant','plants','lesson','cultivation']);

function lessonById(id){
  const n=Number(String(id).match(/(\d{3})$/)?.[1]);
  if(!n) throw new Error('bad id '+id);
  const vol=Math.ceil(n/20);
  const dir=path.join(root,'content','encyclopedia',`volume-${String(vol).padStart(2,'0')}`);
  if(vol<=17){
    return JSON.parse(fs.readFileSync(path.join(dir,'lessons',`thc-enc-${String(n).padStart(3,'0')}.json`),'utf8'));
  }
  for(const file of fs.readdirSync(dir).filter(x=>/^draft-lessons-\d{3}-\d{3}\.json$/.test(x))){
    const pack=JSON.parse(fs.readFileSync(path.join(dir,file),'utf8'));
    const found=(pack.lessons||[]).find(x=>x.id===id);
    if(found) return found;
  }
  throw new Error('lesson not found '+id);
}
const words=s=>String(s||'').toLowerCase().replace(/[^a-z0-9\s-]/g,' ').split(/\s+/).filter(w=>w.length>=5&&!stop.has(w));
for(const ex of examples.examples||[]){
  const lesson=lessonById(ex.lessonId);
  const src=Array.isArray(lesson.sourceNotes)?lesson.sourceNotes:[];
  const limits=Array.isArray(lesson.evidenceLimits)?lesson.evidenceLimits:[lesson.evidenceLimits].filter(Boolean);
  const records=Array.isArray(lesson.measureAndRecord)?lesson.measureAndRecord:[];
  const misconceptions=Array.isArray(lesson.misconceptions)?lesson.misconceptions:[];
  if(src.length<2) errors.push(`${ex.lessonId}: canonical lesson needs at least 2 source notes`);
  if(limits.length<1) errors.push(`${ex.lessonId}: canonical lesson needs evidence limits`);
  if(records.length<1) errors.push(`${ex.lessonId}: canonical lesson needs measure-and-record content`);
  if(misconceptions.length<2) errors.push(`${ex.lessonId}: canonical lesson needs at least 2 misconceptions`);
  const objectiveWords=[...new Set(words(lesson.objective))];
  const exBlob=JSON.stringify(ex).toLowerCase();
  const overlap=objectiveWords.filter(w=>exBlob.includes(w));
  if(overlap.length<2) errors.push(`${ex.lessonId}: worked example is weakly tied to canonical objective; overlap=${overlap.join(',')||'none'}`);
  const forbiddenNumeric=/\b(?:always|never)\b.{0,40}\b(?:ppm|ec|vpd|ppfd|rh|°f|°c|percent|%)\b/i;
  if(forbiddenNumeric.test(exBlob)) errors.push(`${ex.lessonId}: universal numeric language detected`);
  if(ex.learnerFacingEnabled!==true) errors.push(`${ex.lessonId}: learner-facing source-grounded example unexpectedly disabled`);
  if(ex.qualityControl?.accuracyStatus!=='source-grounded') errors.push(`${ex.lessonId}: accuracy status must be source-grounded`);
}
if(errors.length){
  console.error(`Worked-example source grounding failed with ${errors.length} issue(s):`);
  for(const e of errors) console.error(' - '+e);
  process.exit(1);
}
console.log(`Worked-example source grounding PASS: ${examples.examples.length} examples are tied to canonical objectives, source notes, measurements, misconceptions, and evidence limits.`);
