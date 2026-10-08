#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import { encyclopediaLessonRoute } from './lib/encyclopedia-routes.mjs';

const root=process.cwd();
const enc=path.join(root,'content','encyclopedia');
const checkOnly=process.argv.includes('--check');
const apply=process.argv.includes('--apply');
if(checkOnly===apply){
  console.error('Specify exactly one of --check or --apply; refusing implicit writes.');
  process.exit(2);
}
const changed=[]; const errors=[]; const pending=[];

function walk(dir){
  const out=[];
  for(const entry of fs.readdirSync(dir,{withFileTypes:true})){
    const file=path.join(dir,entry.name);
    if(entry.isDirectory()) out.push(...walk(file));
    else if(entry.isFile()&&/^thc-enc-\d+\.json$/i.test(entry.name)) out.push(file);
  }
  return out;
}

for(const file of walk(enc).sort()){
  let lesson;
  try{lesson=JSON.parse(fs.readFileSync(file,'utf8'));}
  catch(error){errors.push(`${path.relative(root,file)}: ${error.message}`);continue;}
  const number=Number(lesson.number??String(lesson.id||'').match(/(\d+)$/)?.[1]);
  if(!Number.isInteger(number)||number<1){errors.push(`${path.relative(root,file)}: invalid lesson number`);continue;}
  const expectedId=`THC-ENC-${String(number).padStart(3,'0')}`;
  const filenameId=`THC-ENC-${String(Number(path.basename(file).match(/^thc-enc-(\d+)\.json$/i)?.[1])).padStart(3,'0')}`;
  if(lesson.id!==expectedId||filenameId!==expectedId){
    errors.push(`${path.relative(root,file)}: lesson id, number, and filename disagree`);
    continue;
  }
  const canonical=encyclopediaLessonRoute(number);
  if(lesson.route===canonical) continue;
  changed.push({id:lesson.id,file:path.relative(root,file),from:lesson.route??null,to:canonical});
  lesson.route=canonical;
  pending.push({file,content:JSON.stringify(lesson,null,2)+'\n'});
}
if(errors.length){console.error(errors.join('\n'));process.exit(1);}
if(apply) for(const entry of pending) fs.writeFileSync(entry.file,entry.content);
console.log(`Encyclopedia canonical route metadata: ${changed.length} lesson(s) ${checkOnly?'require migration':'migrated'}.`);
if(checkOnly&&changed.length){
  changed.slice(0,20).forEach(x=>console.error(`${x.id}: ${x.from} -> ${x.to}`));
  if(changed.length>20) console.error(`… ${changed.length-20} additional route migration(s) required`);
  process.exit(1);
}
