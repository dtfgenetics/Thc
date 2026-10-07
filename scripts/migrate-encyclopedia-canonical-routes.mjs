#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import { encyclopediaLessonRoute } from './lib/encyclopedia-routes.mjs';

const ROOT=process.cwd();
const ENC=path.join(ROOT,'content','encyclopedia');
const checkOnly=process.argv.includes('--check');
const apply=process.argv.includes('--apply');
if(!checkOnly&&!apply) throw new Error('Refusing to rewrite lesson metadata without --apply. Use --check in CI or --apply for an intentional migration.');
const files=[];
function walk(dir){
  for(const entry of fs.readdirSync(dir,{withFileTypes:true})){
    const p=path.join(dir,entry.name);
    if(entry.isDirectory()) walk(p);
    else if(entry.isFile()&&/^thc-enc-\d+\.json$/i.test(entry.name)) files.push(p);
  }
}
walk(ENC);
let changed=0, invalid=0;
for(const file of files.sort()){
  const lesson=JSON.parse(fs.readFileSync(file,'utf8'));
  const number=Number(lesson.number??String(lesson.id||'').match(/(\d+)$/)?.[1]);
  if(!Number.isInteger(number)||number<1){console.error(`Invalid lesson number: ${path.relative(ROOT,file)}`);invalid++;continue;}
  const canonical=encyclopediaLessonRoute(number);
  if(lesson.route===canonical) continue;
  changed++;
  if(!checkOnly){
    lesson.route=canonical;
    fs.writeFileSync(file,JSON.stringify(lesson,null,2)+'\n');
  }
}
console.log(`Encyclopedia canonical route metadata: ${files.length} lessons · ${changed} ${checkOnly?'noncanonical':'migrated'} · ${invalid} invalid.`);
if(invalid||(checkOnly&&changed)) process.exit(1);
