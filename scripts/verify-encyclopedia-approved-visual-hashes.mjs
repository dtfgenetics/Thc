#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';

const root=process.cwd();
const ledgerFile=path.join(root,'data/encyclopedia-visual-approved-assets.json');
if(!fs.existsSync(ledgerFile)) throw new Error('Missing approved assets ledger; build the ledger first.');
const ledger=JSON.parse(fs.readFileSync(ledgerFile,'utf8'));
if(!Array.isArray(ledger.assets)) throw new Error('Approved assets ledger must have an assets array.');
const failures=[];
const results=[];
const seen=new Set();
for(const asset of ledger.assets){
  const rel=asset.repositoryPath;
  const identity=`${asset.lessonId}:${asset.visualRole}:${asset.visualOrdinal}`;
  const expected=`site/wordpress/assets/infographics/${asset.lessonId}_${String(asset.visualOrdinal).padStart(2,'0')}_${asset.visualRole}.png`;
  if(!/^THC-ENC-\d{3,}$/.test(asset.lessonId||'') || !Number.isInteger(asset.visualOrdinal) || asset.visualOrdinal<1 || asset.visualOrdinal>10 || !/^[a-z0-9][a-z0-9_-]*$/i.test(asset.visualRole||'') || rel!==expected){
    failures.push(`${identity}: invalid controlled path`);
    continue;
  }
  if(seen.has(identity)){failures.push(`${identity}: duplicate approved identity`);continue;}
  seen.add(identity);
  const file=path.join(root,rel);
  if(!fs.existsSync(file)){failures.push(`${identity}: missing approved raster`);continue;}
  const data=fs.readFileSync(file);
  const actual=crypto.createHash('sha256').update(data).digest('hex');
  if(!/^[a-f0-9]{64}$/.test(asset.sha256||'') || actual!==asset.sha256) failures.push(`${identity}: approved SHA-256 differs from repository asset`);
  if(data.length!==asset.bytes) failures.push(`${identity}: approved byte count differs from repository asset`);
  if(data.subarray(0,8).toString('hex')!=='89504e470d0a1a0a') failures.push(`${identity}: PNG signature invalid`);
  results.push({lessonId:asset.lessonId,visualTaskId:identity,repositoryPath:rel,expectedSha256:asset.sha256,actualSha256:actual,byteCount:data.length,repositoryMatch:actual===asset.sha256&&data.length===asset.bytes});
}
const report={schemaVersion:'1.0.0',artifactId:'encyclopedia-approved-visual-repository-integrity',scope:'repository-byte-integrity-only',boundary:'This validates canonical repository rasters against approved asset ledger hashes. It does not verify WordPress/CDN public bytes, scientific approval, or live publication.',summary:{approvedAssets:ledger.assets.length,checked:results.length,failures:failures.length},failures,items:results};
const output=path.join(root,'data/encyclopedia-approved-visual-repository-integrity.json');
fs.writeFileSync(output,JSON.stringify(report,null,2)+'\n');
if(failures.length){console.error(failures.join('\n'));process.exit(1);}
console.log(`Approved visual repository hash reconciliation PASS: ${results.length} assets verified. No claim of live/CDN parity.`);
