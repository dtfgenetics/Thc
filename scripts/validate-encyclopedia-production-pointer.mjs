#!/usr/bin/env node
import { readFile } from 'node:fs/promises';

const pointer=JSON.parse(await readFile('site/wordpress/education/encyclopedia/current-production-batch.json','utf8'));
const floor=JSON.parse(await readFile('configuration/encyclopedia-production-floor.json','utf8'));
const files=pointer.lessonFiles;
if(!Array.isArray(files)||files.length===0) throw new Error('Current encyclopedia production pointer has no lesson files.');
const ids=files.map(file=>{
  const match=typeof file==='string' && file.match(/^content\/encyclopedia\/volume-(\d+)\/lessons\/thc-enc-(\d{3})\.json$/i);
  if(!match) throw new Error(`Invalid canonical lesson file path in production pointer: ${String(file)}`);
  const volume=Number(match[1]), id=Number(match[2]);
  if(volume!==Math.ceil(id/20)) throw new Error(`Volume mismatch for THC-ENC-${String(id).padStart(3,'0')}: volume-${volume}`);
  return id;
});
const unique=new Set(ids);
if(unique.size!==ids.length) throw new Error('Current encyclopedia production pointer contains duplicate lesson IDs.');
const max=Math.max(...ids);
const required=Number(floor.minimumPublishedThrough);
if(!Number.isInteger(required)||required<1) throw new Error('Invalid encyclopedia production floor.');
if(max<required) throw new Error(`Encyclopedia current production pointer regressed to THC-ENC-${String(max).padStart(3,'0')}; completed floor is THC-ENC-${String(required).padStart(3,'0')}. Use a separate historical/repair manifest instead.`);
if(required===420 && max===420){
  // A maximum alone cannot prove that the final release includes every Part 21 lesson.
  const expected=Array.from({length:20},(_,i)=>401+i);
  const absent=expected.filter(id=>!unique.has(id));
  if(absent.length) throw new Error(`Completed Part 21 pointer is missing lesson IDs: ${absent.join(', ')}`);
}
console.log(JSON.stringify({ok:true,batch:pointer.batch,maxLessonId:max,lessonCount:ids.length,minimumPublishedThrough:required},null,2));
