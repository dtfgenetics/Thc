#!/usr/bin/env node
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {spawnSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';

const script=path.join(path.dirname(fileURLToPath(import.meta.url)),'build-encyclopedia-visual-promotion-manifest.mjs');
const root=fs.mkdtempSync(path.join(os.tmpdir(),'thc-visual-promotion-safety-'));
const lessonId='THC-ENC-001';
const visualRole='anatomy';
const visualOrdinal=1;
const visualTaskId=`${lessonId}:${visualRole}:${visualOrdinal}`;
const target=`site/wordpress/assets/infographics/${lessonId}_01_anatomy.png`;
const write=(file,data)=>{const full=path.join(root,file);fs.mkdirSync(path.dirname(full),{recursive:true});fs.writeFileSync(full,JSON.stringify(data));};
const run=()=>spawnSync(process.execPath,[script],{cwd:root,encoding:'utf8'});
try {
  const candidate={lessonId,visualRole,visualOrdinal,visualTaskId,targetRepositoryPath:target,machinePreflightPassed:true};
  const preflight={candidates:[candidate]};
  write('data/encyclopedia-independent-review-manifest.json',{lessons:[]});
  write('content/encyclopedia/visual-production-queue-v1.json',{items:[{lessonId,canonicalAssetPaths:[target]}]});
  fs.mkdirSync(path.join(root,'site/wordpress/assets/infographics'),{recursive:true});
  fs.writeFileSync(path.join(root,target),'fixture');
  write('data/encyclopedia-visual-machine-preflight.json',preflight);
  const valid=run();
  if(valid.status!==0) throw Error(`Valid target rejected: ${valid.stderr}`);
  const baseline=JSON.parse(fs.readFileSync(path.join(root,'data/encyclopedia-visual-promotion-manifest.json')));
  if(!baseline.items[0].controlledTargetValid||baseline.items[0].promotionEligible) throw Error('Valid target must pass structural path control but remain review-pending.');
  for(const invalid of [
    {label:'traversal',targetRepositoryPath:'site/wordpress/assets/infographics/../../../../escape.png'},
    {label:'mismatched name',targetRepositoryPath:'site/wordpress/assets/infographics/THC-ENC-002_01_anatomy.png'},
    {label:'mismatched role',targetRepositoryPath:'site/wordpress/assets/infographics/THC-ENC-001_01_other.png'}
  ]){
    write('data/encyclopedia-visual-machine-preflight.json',{candidates:[{...candidate,targetRepositoryPath:invalid.targetRepositoryPath}]});
    const result=run();
    if(result.status===0||!result.stderr.includes('target must match controlled')) throw Error(`Unsafe ${invalid.label} target was not rejected: ${result.stderr}`);
  }
  write('data/encyclopedia-visual-machine-preflight.json',{candidates:[candidate,candidate]});
  const duplicate=run();
  if(duplicate.status===0||!duplicate.stderr.includes('duplicate preflight visual task')) throw Error('Duplicate candidate was not rejected.');
  console.log('Visual promotion target regression PASS: canonical target accepted without approval; traversal, mismatches and duplicate task rejected.');
}finally{
  fs.rmSync(root,{recursive:true,force:true});
}
