#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import { readCanonicalEncyclopediaLessons } from './lib/encyclopedia-canonical-lessons.mjs';

const root=process.cwd();
const lessons=readCanonicalEncyclopediaLessons(root);
const owner=JSON.parse(fs.readFileSync(path.join(root,'content','encyclopedia','review','owner-publication-authorization-2026-10-03.json'),'utf8'));
const rows=lessons.map(lesson=>{
  const control=lesson.reviewControl||{};
  const embeddedAuthorized=(control.publicationAuthorized??lesson.publicationAuthorized??false)===true;
  const releaseTimeReview=String(control.releaseTimeReview||'');
  const releaseReviewRecorded=releaseTimeReview.startsWith(owner.eligibility?.requireReleaseTimeReviewPrefix||'completed_');
  const held=control.safetyHold===true||lesson.safetyHold===true;
  return {
    lessonId:lesson.id,
    number:Number(lesson.number),
    title:lesson.title,
    sourceFile:lesson.__path,
    embeddedPublicationAuthorized:embeddedAuthorized,
    ownerAuthorizationInScope:Number(lesson.number)>=Number(String(owner.scope.from).match(/\d+/)?.[0]||1) && Number(lesson.number)<=Number(String(owner.scope.to).match(/\d+/)?.[0]||420),
    releaseTimeReview:releaseTimeReview||null,
    releaseReviewRecorded,
    independentApproval:control.independentApproval??null,
    safetyHold:held,
    state:held?'safety-hold':embeddedAuthorized&&releaseReviewRecorded?'publication-controlled-complete':releaseReviewRecorded?'owner-override-eligible':'release-review-unrecorded',
    nextAction:held?'resolve-safety-hold':releaseReviewRecorded?'none':'perform-and-record-release-time-review'
  };
});
const out={
  schemaVersion:'1.0.0',
  artifactId:'thc-encyclopedia-release-review-queue',
  ownerAuthorizationId:owner.authorizationId,
  boundary:'Owner publication authorization covers scope but does not synthesize release-time review. Missing release review remains a publication/repair hold until explicitly recorded.',
  summary:{
    lessons:rows.length,
    publicationControlledComplete:rows.filter(x=>x.state==='publication-controlled-complete').length,
    ownerOverrideEligible:rows.filter(x=>x.state==='owner-override-eligible').length,
    releaseReviewUnrecorded:rows.filter(x=>x.state==='release-review-unrecorded').length,
    safetyHolds:rows.filter(x=>x.state==='safety-hold').length
  },
  queue:rows.filter(x=>x.nextAction!=='none')
};
fs.writeFileSync(path.join(root,'data','encyclopedia-release-review-queue.json'),JSON.stringify(out,null,2)+'\n');
console.log(JSON.stringify(out.summary,null,2));
