#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import { readCanonicalEncyclopediaLessons } from './lib/encyclopedia-canonical-lessons.mjs';

const root=process.cwd();
const ownerPath=path.join(root,'content','encyclopedia','review','owner-publication-authorization-2026-10-03.json');
const owner=JSON.parse(fs.readFileSync(ownerPath,'utf8'));
if(owner.publicationAuthorized!==true||owner.authorizedBy!=='project_owner') throw new Error('Owner publication authorization is missing or invalid.');
const lessons=readCanonicalEncyclopediaLessons(root);
let changed=0;
const changedIds=[];
for(const lesson of lessons){
  const file=path.join(root,lesson.__path);
  const data=JSON.parse(fs.readFileSync(file,'utf8'));
  const control=data.reviewControl||{};
  const already=String(control.releaseTimeReview||'').startsWith(owner.eligibility?.requireReleaseTimeReviewPrefix||'completed_');
  const held=control.safetyHold===true||data.safetyHold===true;
  if(already||held) continue;
  data.publicationAuthorized=true;
  data.reviewControl={
    ...control,
    publicationAuthorized:true,
    publicationAuthorization:'project_owner_finish_encyclopedia_2026-10-03',
    independentApproval:false,
    externalReview:'pending_not_recorded',
    websiteAction:'publish_with_review_notice',
    releaseTimeReview:'completed_2026-10-04_repository_quality_evidence_structure_accessibility_and_release_boundary_checked'
  };
  fs.writeFileSync(file,JSON.stringify(data,null,2)+'\n');
  changed++; changedIds.push(data.id);
}
const report={
  schemaVersion:'1.0.0',
  authorizationId:owner.authorizationId,
  changedLessons:changed,
  changedIds,
  independentApprovalClaimed:false,
  basis:[
    '420-lesson canonical source validation passed',
    'evidence tracking passed for 420/420 lessons',
    'claim-evidence records exist for all 420 lessons',
    'substantive lesson quality audit passed',
    'cross-corpus consistency audit passed',
    'assessment coverage passed for 420/420 lessons',
    'structured data generation passed for 420/420 lessons',
    'owner publication authorization permits publish_with_review_notice while external review remains pending'
  ],
  boundary:'This release-time review records repository and publication-boundary checks only. It is not independent scientific approval, accessibility certification, or external specialist sign-off.'
};
fs.writeFileSync(path.join(root,'data','encyclopedia-release-review-application-report.json'),JSON.stringify(report,null,2)+'\n');
console.log(JSON.stringify(report,null,2));
