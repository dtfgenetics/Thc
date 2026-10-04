#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import {
  CORE_ENCYCLOPEDIA_LESSON_COUNT,
  CORE_ENCYCLOPEDIA_PART_COUNT,
  loadEncyclopediaRegistry
} from './lib/encyclopedia-registry.mjs';

const root=process.cwd();
const state=loadEncyclopediaRegistry(root);
const errors=[];
const topicsPath=path.join(root,'configuration','encyclopedia-topics.json');
const topics=fs.existsSync(topicsPath)
  ? JSON.parse(fs.readFileSync(topicsPath,'utf8')).topics||[]
  : [];
const topicByPart=new Map(topics.map(topic=>[Number(topic.part),topic]));

if(state.coreCount!==CORE_ENCYCLOPEDIA_LESSON_COUNT){
  errors.push(`Protected core must remain ${CORE_ENCYCLOPEDIA_LESSON_COUNT} lessons; found ${state.coreCount}.`);
}

const extension=[...state.extensionEntries].sort((a,b)=>Number(a.number)-Number(b.number));
for(let index=0; index<extension.length; index+=1){
  const entry=extension[index];
  const expectedNumber=CORE_ENCYCLOPEDIA_LESSON_COUNT+1+index;
  const expectedId=`THC-ENC-${String(expectedNumber).padStart(3,'0')}`;
  if(Number(entry.number)!==expectedNumber) errors.push(`Extension row ${index+1}: expected number ${expectedNumber}, found ${entry.number}.`);
  if(entry.id!==expectedId) errors.push(`Extension row ${index+1}: expected id ${expectedId}, found ${entry.id}.`);
  if(Number(entry.part)<=CORE_ENCYCLOPEDIA_PART_COUNT) errors.push(`${entry.id}: extension part must be > ${CORE_ENCYCLOPEDIA_PART_COUNT}; found ${entry.part}.`);
  if(!String(entry.title||'').trim()) errors.push(`${entry.id}: title is required.`);
  if(!String(entry.primaryFormat||'').trim()) errors.push(`${entry.id}: primaryFormat is required.`);
  if(!String(entry.teachingVisual||'').trim()) errors.push(`${entry.id}: teachingVisual is required.`);
  const topic=topicByPart.get(Number(entry.part));
  if(!topic){
    errors.push(`${entry.id}: extension part ${entry.part} must be defined in configuration/encyclopedia-topics.json so search and subject-hub browsing stay synchronized.`);
  }else{
    const [start,end]=Array.isArray(topic.range)?topic.range.map(Number):[NaN,NaN];
    if(Number(entry.number)<start||Number(entry.number)>end) errors.push(`${entry.id}: number ${entry.number} is outside configured part ${entry.part} range ${start}–${end}.`);
    if(!String(topic.slug||'').trim()||!String(topic.title||'').trim()) errors.push(`${entry.id}: configured part ${entry.part} needs title and slug.`);
  }
}

if(errors.length){
  console.error(`Encyclopedia extension registry validation failed with ${errors.length} error(s):`);
  errors.forEach(error=>console.error(' - '+error));
  process.exit(1);
}

console.log(`Encyclopedia extension registry PASS: ${state.coreCount} protected core + ${state.extensionCount} extension = ${state.totalCount} registered lessons.`);
