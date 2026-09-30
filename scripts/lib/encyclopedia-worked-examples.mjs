import fs from 'node:fs';
import path from 'node:path';

export function loadWorkedExamples(root=process.cwd()){
  const file=path.join(root,'content','encyclopedia','worked-examples-v1.json');
  return JSON.parse(fs.readFileSync(file,'utf8'));
}

export function learnerFacingWorkedExampleFor(lessonId,root=process.cwd()){
  const data=loadWorkedExamples(root);
  const ex=(data.examples||[]).find(x=>x.lessonId===lessonId);
  if(!ex||ex.learnerFacingEnabled===false) return null;
  const hasCoreShape=
    typeof ex.scenario==='string' && ex.scenario.length>=80 &&
    Array.isArray(ex.reasoningPath) && ex.reasoningPath.length>=5 &&
    Array.isArray(ex.evidenceToCollect) && ex.evidenceToCollect.length>=5 &&
    Array.isArray(ex.weakAnswerPatterns) && ex.weakAnswerPatterns.length>=3 &&
    typeof ex.verification==='string' && ex.verification.length>=100 &&
    typeof ex.boundary==='string' && ex.boundary.length>=100;
  return hasCoreShape?ex:null;
}
