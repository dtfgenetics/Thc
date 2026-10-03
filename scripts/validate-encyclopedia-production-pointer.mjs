#!/usr/bin/env node
import { readFile } from 'node:fs/promises';

const pointerPath='site/wordpress/education/encyclopedia/current-production-batch.json';
const floorPath='configuration/encyclopedia-production-floor.json';

const pointer=JSON.parse(await readFile(pointerPath,'utf8'));
const floor=JSON.parse(await readFile(floorPath,'utf8'));
const ids=(Array.isArray(pointer.lessonFiles)?pointer.lessonFiles:[])
  .flatMap(file=>String(file).match(/thc-enc-(\d{3})/ig)||[])
  .map(value=>Number(value.match(/\d+/)?.[0]||0))
  .filter(Number.isFinite);

if(!ids.length) throw new Error('Current encyclopedia production pointer has no THC-ENC lesson IDs.');
const max=Math.max(...ids);
const min=Math.min(...ids);
const required=Number(floor.minimumPublishedThrough||0);
if(!Number.isInteger(required)||required<1) throw new Error('Invalid encyclopedia production floor.');
if(max<required){
  throw new Error(`Encyclopedia production pointer regressed to THC-ENC-${String(max).padStart(3,'0')}; completed publication floor is THC-ENC-${String(required).padStart(3,'0')}. Use a separate repair/historical manifest instead of moving current-production-batch.json backward.`);
}
if(required===420 && max!==420){
  throw new Error(`Completed 420-entry encyclopedia must keep the current publication cutoff at THC-ENC-420; found ${max}.`);
}
console.log(JSON.stringify({ok:true,batch:pointer.batch,minLessonId:min,maxLessonId:max,minimumPublishedThrough:required},null,2));
