#!/usr/bin/env node
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import http from 'node:http';
import crypto from 'node:crypto';
import {spawnSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
const script=path.join(path.dirname(fileURLToPath(import.meta.url)),'audit-encyclopedia-live-visual-hashes.mjs');
const root=fs.mkdtempSync(path.join(os.tmpdir(),'thc-live-visual-'));
const raster=Buffer.from('89504e470d0a1a0a00000000','hex');
const sha=crypto.createHash('sha256').update(raster).digest('hex');
const name='THC-ENC-001_01_anatomy.png';
const asset={lessonId:'THC-ENC-001',visualRole:'anatomy',visualOrdinal:1,repositoryPath:`site/wordpress/assets/infographics/${name}`,sha256:sha,bytes:raster.length};
fs.mkdirSync(path.join(root,'data'),{recursive:true});
const write=(assets)=>fs.writeFileSync(path.join(root,'data/encyclopedia-visual-approved-assets.json'),JSON.stringify({assets}));
const run=(env)=>spawnSync(process.execPath,[script],{cwd:root,encoding:'utf8',env:{...process.env,...env}});
try{
  write([asset]);
  if(run({ENCYCLOPEDIA_VISUAL_PUBLIC_BASE_URL:'http://example.com/'}).status===0)throw Error('Insecure remote host was accepted');
  if(run({ENCYCLOPEDIA_VISUAL_PUBLIC_BASE_URL:'https://evil.example.org/'}).status===0)throw Error('Untrusted remote host was accepted');
  if(run({ENCYCLOPEDIA_VISUAL_PUBLIC_BASE_URL:'https://dtfseeds.com.invalid/'}).status===0)throw Error('Suffix hostname spoof was accepted');
  write([]);
  if(run({ENCYCLOPEDIA_VISUAL_PUBLIC_BASE_URL:'https://dtfseeds.com/assets/'}).status===0)throw Error('Empty ledger was treated as public parity proof');
  console.log('Live visual parity regression PASS: insecure/untrusted public hosts and empty ledger rejected.');
}finally{fs.rmSync(root,{recursive:true,force:true});}
