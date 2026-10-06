#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';

const root=process.cwd();
const args=process.argv.slice(2);
const valueOf=flag=>{
  const i=args.indexOf(flag);
  return i>=0?args[i+1]:null;
};
const before=valueOf('--before')||process.env.BEFORE_SHA||'';
const head=valueOf('--head')||process.env.HEAD_SHA||'HEAD';
const output=valueOf('--output')||process.env.ENCYCLOPEDIA_CHANGED_BATCH_OUTPUT||path.join(root,'data','encyclopedia-changed-publication-batch.json');
const fallback=valueOf('--fallback')||'site/wordpress/education/encyclopedia/current-production-batch.json';
const canonical=/^content\/encyclopedia\/volume-\d+\/lessons\/thc-enc-\d{3,}\.json$/;

function git(args){
  return execFileSync('git',args,{cwd:root,encoding:'utf8'}).trim();
}
function validSha(value){
  return /^[0-9a-f]{40}$/i.test(String(value||''))&&!/^0{40}$/.test(String(value||''));
}

let diffBase=before;
if(!validSha(diffBase)){
  try{diffBase=git(['rev-parse',head+'^']);}catch{diffBase='';}
}
if(!diffBase){
  console.log(fallback);
  process.exit(0);
}

const names=git(['diff','--name-only',diffBase,head]).split('\n').map(x=>x.trim()).filter(Boolean);
const files=[...new Set(names.filter(x=>canonical.test(x)))].filter(file=>fs.existsSync(path.join(root,file))).sort();
if(!files.length){
  console.log(fallback);
  process.exit(0);
}

const lessons=files.map(file=>JSON.parse(fs.readFileSync(path.join(root,file),'utf8')));
for(let i=0;i<lessons.length;i++){
  const lesson=lessons[i];
  if(!/^THC-ENC-\d{3,}$/.test(String(lesson.id||''))) throw new Error('Invalid changed lesson ID in '+files[i]);
  if(lesson.reviewControl?.publicationAuthorized===false||lesson.publicationAuthorized===false) throw new Error(lesson.id+' is explicitly blocked from publication.');
  if(lesson.reviewControl?.safetyHold===true||lesson.safetyHold===true) throw new Error(lesson.id+' has an explicit safety hold.');
  if(!String(lesson.reviewControl?.releaseTimeReview||'').startsWith('completed_')) throw new Error(lesson.id+' lacks completed releaseTimeReview required for changed-lesson republication.');
}

const manifest={
  schemaVersion:1,
  batch:'changed-lessons-'+String(head).slice(0,12),
  status:'owner_authorized_external_review_pending',
  publicationAuthorized:true,
  validationGate:'changed-lesson-depth-v1',
  source:{
    version:'Changed canonical lesson republication',
    publicationAuthorization:'Republishes canonical lessons already carrying explicit publication authorization after source changes pass repository quality gates.',
    releaseTimeReview:'Each lesson must retain a completed releaseTimeReview and no safety hold.',
    note:'Generated from the merge diff; does not change the controlled current-production pointer.'
  },
  lessonFiles:files,
  generatedFrom:{before:diffBase,head},
  currentProductionPointer:false
};
fs.mkdirSync(path.dirname(output),{recursive:true});
fs.writeFileSync(output,JSON.stringify(manifest,null,2)+'\n');
console.log(output);
