#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';

const root=process.cwd();
const queue=JSON.parse(fs.readFileSync(path.join(root,'site/wordpress/education/encyclopedia-worked-example-review-queue.json'),'utf8'));
const examples=JSON.parse(fs.readFileSync(path.join(root,'content/encyclopedia/worked-examples-v1.json'),'utf8'));
const exMap=new Map((examples.examples||[]).map(x=>[x.lessonId,x]));

function findLesson(id){
  const n=Number(String(id).match(/(\d{3})$/)?.[1]);
  const vol=Math.ceil(n/20);
  const volDir=path.join(root,'content','encyclopedia',`volume-${String(vol).padStart(2,'0')}`);
  if(vol<=17){
    return JSON.parse(fs.readFileSync(path.join(volDir,'lessons',`thc-enc-${String(n).padStart(3,'0')}.json`),'utf8'));
  }
  for(const file of fs.readdirSync(volDir).filter(x=>/^draft-lessons-\d{3}-\d{3}\.json$/.test(x))){
    const pack=JSON.parse(fs.readFileSync(path.join(volDir,file),'utf8'));
    const found=(pack.lessons||[]).find(x=>x.id===id);
    if(found) return found;
  }
  throw new Error(`Lesson not found: ${id}`);
}
const esc=s=>String(s??'').replaceAll('|','\\|').replace(/\s+/g,' ').trim();
const out=[];
out.push('# THC Encyclopedia Worked Example Review Packet');
out.push('');
out.push('**Publication rule:** default deny. Worked examples remain internal until every queue gate is complete and learner-facing approval is explicitly recorded.');
out.push('');
out.push('## Queue summary');
out.push('');
out.push('| Priority | Lesson | Example | Status |');
out.push('|---:|---|---|---|');
for(const item of [...queue.items].sort((a,b)=>a.priority-b.priority||a.lessonId.localeCompare(b.lessonId))){
  const ex=exMap.get(item.lessonId);
  const lesson=findLesson(item.lessonId);
  out.push(`| ${item.priority} | ${item.lessonId} — ${esc(lesson.title)} | ${esc(ex?.title)} | ${item.status} |`);
}
for(const item of [...queue.items].sort((a,b)=>a.priority-b.priority||a.lessonId.localeCompare(b.lessonId))){
  const ex=exMap.get(item.lessonId);
  const lesson=findLesson(item.lessonId);
  out.push('');
  out.push(`## ${item.lessonId} — ${lesson.title}`);
  out.push('');
  out.push(`**Priority:** ${item.priority}  `);
  out.push(`**Queue status:** ${item.status}  `);
  out.push(`**Example:** ${ex.title}`);
  out.push('');
  out.push('### Canonical lesson objective');
  out.push('');
  out.push(lesson.objective);
  out.push('');
  out.push('### Worked scenario');
  out.push('');
  out.push(ex.scenario);
  out.push('');
  out.push('### Reasoning path');
  out.push('');
  ex.reasoningPath.forEach((x,i)=>out.push(`${i+1}. ${x}`));
  out.push('');
  out.push('### Evidence to collect');
  out.push('');
  ex.evidenceToCollect.forEach(x=>out.push(`- ${x}`));
  out.push('');
  out.push('### Weak-answer patterns');
  out.push('');
  ex.weakAnswerPatterns.forEach(x=>out.push(`- ${x}`));
  out.push('');
  out.push('### Verification');
  out.push('');
  out.push(ex.verification);
  out.push('');
  out.push('### Applicability boundary');
  out.push('');
  out.push(ex.boundary);
  out.push('');
  out.push('### Canonical evidence limits');
  out.push('');
  (Array.isArray(lesson.evidenceLimits)?lesson.evidenceLimits:[lesson.evidenceLimits].filter(Boolean)).forEach(x=>out.push(`- ${x}`));
  out.push('');
  out.push('### Source anchors');
  out.push('');
  (lesson.sourceNotes||[]).forEach(x=>out.push(`- ${x}`));
  out.push('');
  out.push('### Review checklist');
  out.push('');
  for(const [key,description] of Object.entries(queue.reviewChecklistDefinition)){
    out.push(`- [${item.review?.[key]?'x':' '}] **${key}** — ${description}`);
  }
  out.push('');
  out.push(`**Reviewer:** ${item.reviewer||'—'}  `);
  out.push(`**Reviewed at:** ${item.reviewedAt||'—'}  `);
  out.push(`**Decision notes:** ${item.decisionNotes||'—'}`);
}
const dest=process.argv[2]||path.join(root,'artifacts','encyclopedia-worked-example-review-packet.md');
fs.mkdirSync(path.dirname(dest),{recursive:true});
fs.writeFileSync(dest,out.join('\n')+'\n');
console.log(`Wrote reviewer packet for ${queue.items.length} examples to ${dest}`);
