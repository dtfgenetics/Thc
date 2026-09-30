import fs from 'node:fs';
import path from 'node:path';

export function loadWorkedExamples(root=process.cwd()){
  const file=path.join(root,'content','encyclopedia','worked-examples-v1.json');
  const data=JSON.parse(fs.readFileSync(file,'utf8'));
  return data;
}

export function learnerFacingWorkedExampleFor(lessonId,root=process.cwd()){
  const data=loadWorkedExamples(root);
  const ex=(data.examples||[]).find(x=>x.lessonId===lessonId);
  if(!ex) return null;
  const rc=ex.reviewControl||{};
  const approved=ex.learnerFacingApproved===true
    && rc.independentReviewStatus==='approved'
    && typeof rc.approvedForLearnerFacingAt==='string'
    && rc.approvedForLearnerFacingAt.length>=10
    && typeof rc.approvedBy==='string'
    && rc.approvedBy.trim().length>=2;
  return approved?ex:null;
}
