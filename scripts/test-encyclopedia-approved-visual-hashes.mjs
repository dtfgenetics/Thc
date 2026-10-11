#!/usr/bin/env node
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import crypto from 'node:crypto';
import {spawnSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';

const script=path.join(path.dirname(fileURLToPath(import.meta.url)),'verify-encyclopedia-approved-visual-hashes.mjs');
const root=fs.mkdtempSync(path.join(os.tmpdir(),'encyclopedia-visual-hash-'));
const rel='site/wordpress/assets/infographics/THC-ENC-001_01_anatomy.png';
const sample=Buffer.from('89504e470d0a1a0a00000000','hex');
const hash=crypto.createHash('sha256').update(sample).digest('hex');
const asset={lessonId:'THC-ENC-001',visualRole:'anatomy',visualOrdinal:1,repositoryPath:rel,sha256:hash,bytes:sample.length};
const ledger=(assets)=>fs.writeFileSync(path.join(root,'data/encyclopedia-visual-approved-assets.json'),JSON.stringify({assets}));
const run=()=>spawnSync(process.execPath,[script],{cwd:root,encoding:'utf8'});
try{
  fs.mkdirSync(path.join(root,'data'),{recursive:true});
  fs.mkdirSync(path.dirname(path.join(root,rel)),{recursive:true});
  fs.writeFileSync(path.join(root,rel),sample);
  ledger([asset]);
  if(run().status!==0) throw Error('Matching approval hash was rejected');
  const report=JSON.parse(fs.readFileSync(path.join(root,'data/encyclopedia-approved-visual-repository-integrity.json')));
  if(report.summary.checked!==1||report.summary.failures!==0) throw Error('Expected one passing integrity record');
  const mutations=[
    ['tampered hash',{...asset,sha256:'0'.repeat(64)}],
    ['wrong bytes',{...asset,bytes:999}],
    ['path escape',{...asset,repositoryPath:'site/wordpress/assets/infographics/../../../../wrong.png'}],
    ['wrong role path',{...asset,visualRole:'roots'}]
  ];
  for(const [label,changed] of mutations){ledger([changed]);if(run().status===0) throw Error(`Failed to reject ${label}`);}
  ledger([asset,asset]);if(run().status===0) throw Error('Duplicate approved visual passed');
  fs.unlinkSync(path.join(root,rel));
  ledger([asset]);if(run().status===0) throw Error('Missing approved image passed');
  console.log('Approved asset SHA-256 reconciliation regression PASS');
}finally{fs.rmSync(root,{recursive:true,force:true});}
