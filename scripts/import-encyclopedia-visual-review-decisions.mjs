#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';

const root=process.cwd();
const reviewDir=path.join(root,'review','encyclopedia-visuals');
const manifestPath=path.join(root,'data','encyclopedia-independent-review-manifest.json');
if(!fs.existsSync(manifestPath)) throw new Error('Missing independent-review manifest. Build it first.');
if(!fs.existsSync(reviewDir)) throw new Error('Missing review/encyclopedia-visuals reviewer packets.');

const manifest=JSON.parse(fs.readFileSync(manifestPath,'utf8'));
const byId=new Map((manifest.lessons||[]).map(x=>[x.lessonId,x]));
const decisions=new Set(['approved','changes_requested','rejected']);
const bools=['scienceAccuracy','labelingAccuracy','misconceptionSafety','accessibilityQuality','provenanceRights','responsiveLegibility'];
const files=fs.readdirSync(reviewDir).filter(x=>/^(?:batch-\d{3}|produced-review-\d{3})\.json$/i.test(x)).sort();
const seen=new Set(),errors=[]; let completed=0,approved=0;

for(const file of files){
  const packet=JSON.parse(fs.readFileSync(path.join(reviewDir,file),'utf8'));
  for(const item of packet.items||[]){
    if(seen.has(item.lessonId)) errors.push(`${item.lessonId}: duplicate review row across packets`);
    seen.add(item.lessonId);
    const target=byId.get(item.lessonId);
    if(!target){errors.push(`${item.lessonId}: unknown lesson`);continue;}
    const r=item.reviewInput||{};
    const any=Object.values(r).some(v=>v!==null&&v!=='');
    if(!any) continue;
    completed++;
    if(!decisions.has(r.decision)) errors.push(`${item.lessonId}: invalid decision`);
    if(!String(r.reviewerId||'').trim()) errors.push(`${item.lessonId}: reviewerId required`);
    if(!String(r.reviewerName||'').trim()) errors.push(`${item.lessonId}: reviewerName required`);
    if(!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?Z$/.test(String(r.reviewedAt||''))) errors.push(`${item.lessonId}: reviewedAt must be UTC ISO 8601`);
    if(String(r.reviewNotes||'').trim().length<40) errors.push(`${item.lessonId}: reviewNotes must be at least 40 characters`);
    for(const key of bools) if(typeof r[key]!=='boolean') errors.push(`${item.lessonId}: ${key} must be boolean`);
    if(r.decision==='approved'&&bools.some(key=>r[key]!==true)) errors.push(`${item.lessonId}: approval requires every controlled review check=true`);
    if(r.decision==='approved'&&Number(item.evidence?.claimEvidenceCount||0)<1) errors.push(`${item.lessonId}: approval requires claim evidence`);
    if(errors.some(e=>e.startsWith(item.lessonId+':'))) continue;
    target.reviewTasks.teachingVisual.reviewerDecision=r.decision;
    target.reviewTasks.teachingVisual.reviewerId=String(r.reviewerId).trim();
    target.reviewTasks.teachingVisual.reviewerName=String(r.reviewerName).trim();
    target.reviewTasks.teachingVisual.reviewedAt=r.reviewedAt;
    target.reviewTasks.teachingVisual.reviewNotes=String(r.reviewNotes).trim();
    target.reviewTasks.teachingVisual.reviewChecks=Object.fromEntries(bools.map(key=>[key,r[key]]));
    target.reviewTasks.teachingVisual.reviewSourcePacket=file;
    if(r.decision==='approved') approved++;
  }
}
if(seen.size!==420) errors.push(`Expected 420 unique visual review rows; found ${seen.size}`);
if(errors.length){console.error('Visual review ingestion failed:');errors.slice(0,200).forEach(x=>console.error(' - '+x));process.exit(1);}
manifest.summary.visualReviewDecisionsImported=completed;
manifest.summary.visualReviewsApproved=approved;
manifest.summary.visualReviewsChangesRequested=(manifest.lessons||[]).filter(x=>x.reviewTasks.teachingVisual.reviewerDecision==='changes_requested').length;
manifest.summary.visualReviewsRejected=(manifest.lessons||[]).filter(x=>x.reviewTasks.teachingVisual.reviewerDecision==='rejected').length;
manifest.reviewBoundary+=' Reviewer-packet decisions are imported only after fail-closed identity, timestamp, notes, controlled-check, evidence, uniqueness, and coverage validation.';
fs.writeFileSync(manifestPath,JSON.stringify(manifest,null,2)+'\n');
console.log(JSON.stringify({reviewRows:seen.size,completed,approved},null,2));
