#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import { buildLessonRubricV1 } from './lib/encyclopedia-assessment-v2.mjs';

const root=process.cwd();
const encRoot=path.join(root,'content','encyclopedia');
const out=process.argv[2]||path.join(root,'artifacts','encyclopedia-rubrics-v1.json');
const lessons=[];

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

const payload={
  schemaVersion:1,
  generatedAt:new Date().toISOString(),
  reviewStatus:'pending_independent_review',
  publicationStatus:'internal_grading_support_not_public_answer_key',
  lessonCount:lessons.length,
  rubrics:lessons.map(buildLessonRubricV1)
};
fs.mkdirSync(path.dirname(out),{recursive:true});
fs.writeFileSync(out,JSON.stringify(payload,null,2)+'\n');
console.log(`Wrote ${payload.lessonCount} encyclopedia rubrics to ${out}`);
