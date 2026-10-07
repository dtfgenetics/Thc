#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';

const root=process.cwd();
const reviewDir=path.join(root,'review','encyclopedia-visuals');
const manifestPath=path.join(root,'data','encyclopedia-independent-review-manifest.json');
if(!fs.existsSync(manifestPath)) throw new Error('Missing independent-review manifest. Build it first.');
if(!fs.existsSync(reviewDir)) throw new Error('Missing review/encyclopedia-visuals reviewer packets.');

const manifest=JSON.parse(fs.readFileSync(manifestPath,'utf8'));
const reviewIndexPath=path.join(reviewDir,'index.json');
if(!fs.existsSync(reviewIndexPath)) throw new Error('Missing reviewer packet index.');
const reviewIndex=JSON.parse(fs.readFileSync(reviewIndexPath,'utf8'));
const byId=new Map((manifest.lessons||[]).map(x=>[x.lessonId,x]));
const decisions=new Set(['approved','changes_requested','rejected']);
const bools=['scienceAccuracy','labelingAccuracy','misconceptionSafety','accessibilityQuality','provenanceRights','responsiveLegibility'];
const files=fs.readdirSync(reviewDir).filter(x=>/^(?:batch-\d{3}|produced-review-\d{3})\.json$/i.test(x)).sort();
const taskKey=item=>item.visualTaskId||item.targetRepositoryPath||(Array.isArray(item.candidateAssetPaths)&&item.candidateAssetPaths[0])||`${item.lessonId}:${item.visualRole||'legacy'}:${item.visualOrdinal||0}`;
const seen=new Set(),errors=[]; let completed=0,approved=0,changesRequested=0,rejected=0;

for(const lesson of manifest.lessons||[]){
  lesson.reviewTasks=lesson.reviewTasks||{};
  lesson.reviewTasks.teachingVisual=lesson.reviewTasks.teachingVisual||{};
  lesson.reviewTasks.teachingVisual.visualReviews={};
  // A lesson-level approval must never authorize every role. Exact visual-task reviews are authoritative.
  lesson.reviewTasks.teachingVisual.reviewerDecision=null;
  lesson.reviewTasks.teachingVisual.reviewerId=null;
  lesson.reviewTasks.teachingVisual.reviewerName=null;
  lesson.reviewTasks.teachingVisual.reviewedAt=null;
  lesson.reviewTasks.teachingVisual.reviewNotes=null;
  lesson.reviewTasks.teachingVisual.reviewChecks={};
  lesson.reviewTasks.teachingVisual.reviewSourcePacket=null;
}

for(const file of files){
  const packet=JSON.parse(fs.readFileSync(path.join(reviewDir,file),'utf8'));
  for(const item of packet.items||[]){
    const key=taskKey(item);
    if(seen.has(key)) errors.push(`${key}: duplicate visual review task across packets`);
    seen.add(key);
    const target=byId.get(item.lessonId);
    if(!target){errors.push(`${key}: unknown lesson`);continue;}
    const r=item.reviewInput||{};
    const any=Object.values(r).some(v=>v!==null&&v!=='');
    if(!any) continue;
    completed++;
    const itemErrors=[];
    if(!decisions.has(r.decision)) itemErrors.push('invalid decision');
    if(!String(r.reviewerId||'').trim()) itemErrors.push('reviewerId required');
    if(!String(r.reviewerName||'').trim()) itemErrors.push('reviewerName required');
    if(!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?Z$/.test(String(r.reviewedAt||''))) itemErrors.push('reviewedAt must be UTC ISO 8601');
    if(String(r.reviewNotes||'').trim().length<40) itemErrors.push('reviewNotes must be at least 40 characters');
    for(const check of bools) if(typeof r[check]!=='boolean') itemErrors.push(`${check} must be boolean`);
    if(r.decision==='approved'&&bools.some(check=>r[check]!==true)) itemErrors.push('approval requires every controlled review check=true');
    if(r.decision==='approved'&&Number(item.evidence?.claimEvidenceCount||0)<1) itemErrors.push('approval requires claim evidence');
    if(itemErrors.length){errors.push(...itemErrors.map(e=>`${key}: ${e}`));continue;}
    target.reviewTasks.teachingVisual.visualReviews[key]={
      visualTaskId:key,
      visualRole:item.visualRole||null,
      visualOrdinal:item.visualOrdinal||null,
      targetRepositoryPath:item.targetRepositoryPath||(item.candidateAssetPaths||[])[0]||null,
      decision:r.decision,
      reviewerId:String(r.reviewerId).trim(),
      reviewerName:String(r.reviewerName).trim(),
      reviewedAt:r.reviewedAt,
      reviewNotes:String(r.reviewNotes).trim(),
      reviewChecks:Object.fromEntries(bools.map(check=>[check,r[check]])),
      reviewSourcePacket:file
    };
    if(r.decision==='approved') approved++;
    if(r.decision==='changes_requested') changesRequested++;
    if(r.decision==='rejected') rejected++;
  }
}
const expected=Number(reviewIndex.candidateCount||0);
if(seen.size!==expected) errors.push(`Expected ${expected} unique visual review tasks from review index; found ${seen.size}`);
if(errors.length){console.error('Visual review ingestion failed:');errors.slice(0,200).forEach(x=>console.error(' - '+x));process.exit(1);}
manifest.summary.visualReviewTasks=seen.size;
manifest.summary.visualReviewDecisionsImported=completed;
manifest.summary.visualReviewsApproved=approved;
manifest.summary.visualReviewsChangesRequested=changesRequested;
manifest.summary.visualReviewsRejected=rejected;
manifest.reviewBoundary+=' Reviewer-packet decisions are imported per exact visual task; one reviewed role can never authorize sibling visuals for the same lesson.';
fs.writeFileSync(manifestPath,JSON.stringify(manifest,null,2)+'\n');
console.log(JSON.stringify({reviewTasks:seen.size,completed,approved,changesRequested,rejected},null,2));
