#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import { readCanonicalEncyclopediaLessons } from './lib/encyclopedia-canonical-lessons.mjs';
import { loadEncyclopediaRegistry } from './lib/encyclopedia-registry.mjs';

const root=process.cwd();
const ownerAuthorizationPath=path.join(root,'content','encyclopedia','review','owner-publication-authorization-2026-10-03.json');
const ownerAuthorization=JSON.parse(fs.readFileSync(ownerAuthorizationPath,'utf8'));
const outPath=process.env.ENCYCLOPEDIA_FULL_BATCH_FILE||path.join(root,'site','wordpress','education','encyclopedia','full-420-production-batch.generated.json');
const registryState=loadEncyclopediaRegistry(root);
const lessons=readCanonicalEncyclopediaLessons(root).sort((a,b)=>Number(a.number)-Number(b.number));
if(lessons.length!==registryState.totalCount) throw new Error(`Expected ${registryState.totalCount} registered canonical lessons; found ${lessons.length}.`);
const ids=lessons.map(x=>x.id);
const expected=registryState.entries.slice().sort((a,b)=>Number(a.number)-Number(b.number)).map(entry=>entry.id);
if(new Set(ids).size!==registryState.totalCount||expected.some((id,i)=>ids[i]!==id)) throw new Error('Canonical lesson set must match the ordered combined core + extension registry.');
const authorizedLessons=[];
const heldLessons=[];
const ownerOverrideLessonIds=[];
for(const lesson of lessons){
  if(!lesson.__path||!fs.existsSync(path.join(root,lesson.__path))) throw new Error(`${lesson.id}: canonical source path missing.`);
  const control=lesson.reviewControl||{};
  const publicationAuthorized=control.publicationAuthorized ?? lesson.publicationAuthorized ?? false;
  const releaseTimeReview=String(control.releaseTimeReview||'');
  const explicitSafetyHold=control.safetyHold===true || lesson.safetyHold===true;
  const eligibleForOwnerOverride=
    ownerAuthorization.publicationAuthorized===true &&
    ownerAuthorization.independentApproval===false &&
    releaseTimeReview.startsWith(ownerAuthorization.eligibility?.requireReleaseTimeReviewPrefix||'completed_') &&
    !explicitSafetyHold &&
    control.independentApproval!==true;
  if(publicationAuthorized===true){
    authorizedLessons.push(lesson);
  }else if(eligibleForOwnerOverride){
    authorizedLessons.push(lesson);
    ownerOverrideLessonIds.push(lesson.id);
  }else{
    heldLessons.push({id:lesson.id,reason:explicitSafetyHold?'explicit_safety_hold':(control.websiteAction||'publication_not_authorized')});
  }
}
if(!authorizedLessons.length) throw new Error('No encyclopedia lessons are currently publication-authorized.');
if(ownerOverrideLessonIds.length && ownerAuthorization.authorizedBy!=='project_owner') throw new Error('Owner override requires project_owner authorization.');
const output={
  schemaVersion:1,
  batch:`full-${registryState.totalCount}-canonical-sync`,
  status:'owner_authorized_external_review_pending',
  publicationAuthorized:true,
  ownerPublicationOverride:true,
  ownerPublicationAuthorizationId:ownerAuthorization.authorizationId,
  ownerOverrideLessonIds,
  generatedAt:new Date().toISOString(),
  source:{
    controlledCatalogueVersion:'Master Content Map v1.1',
    publicationAuthorization:'Project owner authorized completion and publication of the Encyclopedia on 2026-10-03. Independent specialist approval remains a separate project-control field and is not implied by website publication.',
    note:'Runtime-generated full canonical synchronization manifest. It changes website publication coverage only; it does not change independent review state.'
  },
  canonicalLessonCount:lessons.length,
  publicationAuthorizedLessonCount:authorizedLessons.length,
  heldLessonCount:heldLessons.length,
  heldLessons,
  ownerOverrideLessonCount:ownerOverrideLessonIds.length,
  lessonFiles:authorizedLessons.map(x=>x.__path)
};
fs.mkdirSync(path.dirname(outPath),{recursive:true});
fs.writeFileSync(outPath,JSON.stringify(output,null,2)+'\n');
console.log(`Encyclopedia publication manifest: ${output.lessonFiles.length}/${registryState.totalCount} publishable lessons · ${output.ownerOverrideLessonCount} owner-authorized override(s) · ${output.heldLessonCount} held`);
console.log(path.relative(root,outPath));
