#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import { readCanonicalEncyclopediaLessons } from './lib/encyclopedia-canonical-lessons.mjs';

const root=process.cwd();
const outPath=process.env.ENCYCLOPEDIA_FULL_BATCH_FILE||path.join(root,'site','wordpress','education','encyclopedia','full-420-production-batch.generated.json');
const lessons=readCanonicalEncyclopediaLessons(root).sort((a,b)=>Number(a.number)-Number(b.number));
if(lessons.length!==420) throw new Error(`Expected 420 canonical lessons; found ${lessons.length}.`);
const ids=lessons.map(x=>x.id);
const expected=Array.from({length:420},(_,i)=>`THC-ENC-${String(i+1).padStart(3,'0')}`);
if(new Set(ids).size!==420||expected.some((id,i)=>ids[i]!==id)) throw new Error('Canonical lesson set must be ordered THC-ENC-001 through THC-ENC-420.');
const authorizedLessons=[];
const heldLessons=[];
for(const lesson of lessons){
  if(!lesson.__path||!fs.existsSync(path.join(root,lesson.__path))) throw new Error(`${lesson.id}: canonical source path missing.`);
  const publicationAuthorized=lesson.reviewControl?.publicationAuthorized ?? lesson.publicationAuthorized ?? false;
  if(publicationAuthorized===true) authorizedLessons.push(lesson);
  else heldLessons.push({id:lesson.id,reason:lesson.reviewControl?.websiteAction||'publication_not_authorized'});
}
if(!authorizedLessons.length) throw new Error('No encyclopedia lessons are currently publication-authorized.');
const output={
  schemaVersion:1,
  batch:'full-420-canonical-sync',
  status:'owner_authorized_external_review_pending',
  publicationAuthorized:true,
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
  lessonFiles:authorizedLessons.map(x=>x.__path)
};
fs.mkdirSync(path.dirname(outPath),{recursive:true});
fs.writeFileSync(outPath,JSON.stringify(output,null,2)+'\n');
console.log(`Encyclopedia publication manifest: ${output.lessonFiles.length}/420 authorized lessons · ${output.heldLessonCount} held`);
console.log(path.relative(root,outPath));
