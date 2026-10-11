#!/usr/bin/env node
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {spawnSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
const script=path.join(path.dirname(fileURLToPath(import.meta.url)),'build-encyclopedia-visual-approved-assets.mjs');
const root=fs.mkdtempSync(path.join(os.tmpdir(),'thc-approved-asset-'));
const lessonId='THC-ENC-001',visualRole='anatomy',visualOrdinal=1;
const target=`site/wordpress/assets/infographics/${lessonId}_01_anatomy.png`;
const reviewChecks=Object.fromEntries(['scienceAccuracy','labelingAccuracy','misconceptionSafety','accessibilityQuality','provenanceRights','responsiveLegibility'].map(k=>[k,true]));
const base={lessonId,visualRole,visualOrdinal,visualTaskId:`${lessonId}:anatomy:1`,targetRepositoryPath:target,promotionEligible:true,machinePreflightPassed:true,controlledTargetValid:true,candidateAssetPresent:true,independentVisualReview:{evidenceComplete:true,decision:'approved',reviewerId:'fixture-reviewer',reviewedAt:'2026-10-11T12:00:00Z',reviewNotes:'fixture only',reviewChecks}};
const write=(items)=>{fs.mkdirSync(path.join(root,'data'),{recursive:true});fs.writeFileSync(path.join(root,'data/encyclopedia-visual-promotion-manifest.json'),JSON.stringify({items}));};
const run=()=>spawnSync(process.execPath,[script],{cwd:root,encoding:'utf8'});
try {
  fs.mkdirSync(path.dirname(path.join(root,target)),{recursive:true});
  fs.writeFileSync(path.join(root,target),Buffer.from('89504e470d0a1a0a', 'hex'));
  write([base]);
  const success=run();
  if(success.status!==0) throw Error(`Valid fixture rejected: ${success.stderr}`);
  const ledger=JSON.parse(fs.readFileSync(path.join(root,'data/encyclopedia-visual-approved-assets.json')));
  if(ledger.assets.length!==1||ledger.assets[0].visualTaskId!==base.visualTaskId) throw Error('Approved task identity was not retained');
  for(const [label,row] of [
    ['traversal',{...base,targetRepositoryPath:'site/wordpress/assets/infographics/../../../../escape.png'}],
    ['spoofed review',{...base,independentVisualReview:{...base.independentVisualReview,reviewChecks:{...reviewChecks,scienceAccuracy:false}}}],
    ['missing preflight',{...base,machinePreflightPassed:false}],
    ['missing controlled target',{...base,controlledTargetValid:false}]
  ]){
    write([row]);const result=run();
    if(result.status===0) throw Error(`Approved-asset builder accepted ${label}`);
  }
  write([base,base]);if(run().status===0)throw Error('Duplicate asset was accepted');
  console.log('Approved asset integrity PASS: valid asset hashed; bad paths, forged review checks, missing gates, and duplicates rejected.');
}finally{fs.rmSync(root,{recursive:true,force:true});}
