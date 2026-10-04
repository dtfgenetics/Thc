#!/usr/bin/env node
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { readCanonicalEncyclopediaLessons } from './lib/encyclopedia-canonical-lessons.mjs';
import { loadEncyclopediaRegistry } from './lib/encyclopedia-registry.mjs';

const here=path.dirname(fileURLToPath(import.meta.url));
const root=fs.mkdtempSync(path.join(os.tmpdir(),'thc-encyclopedia-420plus-'));

try{
  const enc=path.join(root,'content','encyclopedia');
  const configDir=path.join(root,'configuration');
  fs.mkdirSync(path.join(enc,'volume-22','lessons'),{recursive:true});
  fs.mkdirSync(configDir,{recursive:true});

  const coreEntries=Array.from({length:420},(_,index)=>{
    const number=index+1;
    return {
      id:`THC-ENC-${String(number).padStart(3,'0')}`,
      number,
      part:Math.ceil(number/20),
      title:`Core lesson ${number}`,
      primaryFormat:'Science lesson',
      teachingVisual:'Concept diagram'
    };
  });
  fs.writeFileSync(path.join(enc,'current-controlled-registry.json'),JSON.stringify({schemaVersion:'1.0.0',entries:coreEntries},null,2));

  const extensionEntries=[421,422].map(number=>({
    id:`THC-ENC-${number}`,
    number,
    part:22,
    title:`Extension lesson ${number}`,
    primaryFormat:'Science lesson',
    teachingVisual:'Concept diagram'
  }));
  fs.writeFileSync(path.join(enc,'extension-registry.json'),JSON.stringify({schemaVersion:'1.0.0',entries:extensionEntries},null,2));

  const topics=Array.from({length:21},(_,index)=>({
    part:index+1,
    slug:`core-part-${index+1}`,
    title:`Core Part ${index+1}`,
    range:[index*20+1,(index+1)*20],
    description:'Protected core topic'
  }));
  topics.push({part:22,slug:'extension-science',title:'Extension Science',range:[421,440],description:'420+ extension topic'});
  fs.writeFileSync(path.join(configDir,'encyclopedia-topics.json'),JSON.stringify({schemaVersion:1,topics},null,2));

  for(const entry of extensionEntries){
    fs.writeFileSync(path.join(enc,'volume-22','lessons',`thc-enc-${entry.number}.json`),JSON.stringify({
      ...entry,
      slug:`thc-enc-${entry.number}`,
      objective:'Synthetic extension fixture used only to verify 420+ discovery and registry behavior.'
    },null,2));
  }

  const state=loadEncyclopediaRegistry(root);
  if(state.coreCount!==420||state.extensionCount!==2||state.totalCount!==422) throw new Error(`Unexpected combined registry counts: ${JSON.stringify({core:state.coreCount,extension:state.extensionCount,total:state.totalCount})}`);
  if(state.entries.at(-1)?.id!=='THC-ENC-422') throw new Error('Combined registry did not retain THC-ENC-422.');

  const discovered=readCanonicalEncyclopediaLessons(root);
  if(discovered.length!==2||discovered.map(row=>row.id).join(',')!=='THC-ENC-421,THC-ENC-422') throw new Error(`Dynamic volume reader did not discover extension lessons: ${discovered.map(row=>row.id).join(',')}`);
  if(discovered.some(row=>row.__part!==22||row.__sourceKind!=='individual-canonical')) throw new Error('Extension lesson provenance metadata is incorrect.');

  const validator=spawnSync(process.execPath,[path.join(here,'validate-encyclopedia-extension-registry.mjs')],{cwd:root,encoding:'utf8'});
  if(validator.status!==0) throw new Error(`Extension validator rejected valid 421+ fixture:\n${validator.stdout}\n${validator.stderr}`);

  console.log('THC Encyclopedia 420+ extension smoke test PASS: protected 420 core + THC-ENC-421/422 registry and Volume 22 discovery validated.');
}finally{
  fs.rmSync(root,{recursive:true,force:true});
}
