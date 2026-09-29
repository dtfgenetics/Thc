#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import { buildLessonRubricV1 } from './lib/encyclopedia-assessment-v2.mjs';

const root=process.cwd();
const encRoot=path.join(root,'content','encyclopedia');
const errors=[];
const lessons=[];
const seen=new Set();

for(let vol=1;vol<=17;vol++){
  const dir=path.join(encRoot,`volume-${String(vol).padStart(2,'0')}`,'lessons');
  for(const name of fs.readdirSync(dir).filter(n=>/^thc-enc-\d{3}\.json$/.test(n)).sort()){
    lessons.push(JSON.parse(fs.readFileSync(path.join(dir,name),'utf8')));
  }
}
for(let vol=18;vol<=21;vol++){
  const dir=path.join(encRoot,`volume-${String(vol).padStart(2,'0')}`);
  for(const name of fs.readdirSync(dir).filter(n=>/^draft-lessons-\d{3}-\d{3}\.json$/.test(n)).sort()){
    const pack=JSON.parse(fs.readFileSync(path.join(dir,name),'utf8'));
    lessons.push(...(pack.lessons||[]));
  }
}
if(lessons.length!==420) errors.push(`Expected 420 lessons; found ${lessons.length}`);

for(const lesson of lessons){
  const r=buildLessonRubricV1(lesson);
  if(!r.lessonId||seen.has(r.lessonId)) errors.push(`Invalid/duplicate rubric lesson id: ${r.lessonId}`);
  seen.add(r.lessonId);
  if(r.schemaVersion!==1) errors.push(`${r.lessonId}: rubric schemaVersion must be 1`);
  if(r.reviewStatus!=='pending_independent_review') errors.push(`${r.lessonId}: rubric review status must remain pending_independent_review`);
  if(r.publicationStatus!=='internal_grading_support_not_public_answer_key') errors.push(`${r.lessonId}: rubric must remain internal grading support`);
  if(r.scoringScale?.totalPoints!==12) errors.push(`${r.lessonId}: rubric must total 12 points`);
  const criteria=r.scoringScale?.criteria||[];
  if(criteria.length!==5) errors.push(`${r.lessonId}: rubric must define exactly 5 criteria`);
  const total=criteria.reduce((n,c)=>n+Number(c.points||0),0);
  if(total!==12) errors.push(`${r.lessonId}: rubric criterion points sum to ${total}, expected 12`);
  for(const c of criteria){
    if(String(c.standard||'').length<80) errors.push(`${r.lessonId}: criterion ${c.id} standard too thin`);
  }
  if((r.strongAnswerMustInclude||[]).length<4) errors.push(`${r.lessonId}: strong-answer requirements too thin`);
  if((r.commonReasoningErrors||[]).length<4) errors.push(`${r.lessonId}: common reasoning errors too thin`);
  if((r.reviewerEvidence?.coreScienceAnchors||[]).length<2) errors.push(`${r.lessonId}: needs at least 2 core-science anchors`);
  if((r.reviewerEvidence?.sourceAnchors||[]).length<2) errors.push(`${r.lessonId}: needs at least 2 source anchors`);
  if((r.prompts||[]).length<3) errors.push(`${r.lessonId}: needs 3 assessment prompts`);
}

if(errors.length){
  console.error(`Encyclopedia rubric validation failed with ${errors.length} issue(s):`);
  for(const e of errors.slice(0,200)) console.error(' - '+e);
  process.exit(1);
}
console.log('Encyclopedia rubric PASS: 420/420 lessons have controlled internal 12-point grading rubrics with evidence, misconception, uncertainty, and verification criteria.');
