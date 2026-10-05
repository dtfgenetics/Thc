#!/usr/bin/env node
import fs from 'node:fs'; import path from 'node:path';
const root=process.cwd(), dir=path.join(root,'review','encyclopedia-assessment-rationales'), errors=[];
const files=fs.existsSync(dir)?fs.readdirSync(dir).filter(x=>/^batch-\d{3}\.json$/i.test(x)).sort():[];
const decisions=new Set(['approved','changes_requested','rejected']), bools=['taughtByLesson','reasoningAccuracy','misconceptionHandling','measurementAlignment','evidenceBoundaryAlignment'];
let rows=0,completed=0,approved=0; const seen=new Set();
for(const file of files){
  const p=JSON.parse(fs.readFileSync(path.join(dir,file),'utf8'));
  if(p.packetType!=='assessment-rationale-independent-review-input') errors.push(file+': packetType mismatch');
  for(const item of p.items||[]){
    rows++; if(seen.has(item.lessonId)) errors.push(item.lessonId+': duplicate'); seen.add(item.lessonId);
    if((item.prompts||[]).length!==3||(item.rationales||[]).length!==3) errors.push(item.lessonId+': expected three prompts and rationales');
    const r=item.reviewInput||{}, any=Object.values(r).some(v=>v!==null&&v!==''); if(!any) continue; completed++;
    if(!decisions.has(r.decision)) errors.push(item.lessonId+': invalid decision');
    if(!String(r.reviewerId||'').trim()||!String(r.reviewerName||'').trim()) errors.push(item.lessonId+': reviewer identity required');
    if(!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?Z$/.test(String(r.reviewedAt||''))) errors.push(item.lessonId+': invalid reviewedAt');
    if(String(r.reviewNotes||'').trim().length<40) errors.push(item.lessonId+': reviewNotes too short');
    for(const k of bools) if(typeof r[k]!=='boolean') errors.push(item.lessonId+`: ${k} must be boolean`);
    if(r.decision==='approved'){approved++; for(const k of bools) if(r[k]!==true) errors.push(item.lessonId+`: approval requires ${k}=true`);}
  }
}
if(rows!==420) errors.push(`Expected 420 assessment review rows; found ${rows}`);
if(errors.length){console.error(`Assessment review packet validation failed with ${errors.length} issue(s):`);errors.slice(0,200).forEach(x=>console.error(' - '+x));process.exit(1);}
console.log(`Assessment review packets PASS: ${rows} lessons · ${completed} completed · ${approved} approved. Blank review fields remain non-promoting.`);
