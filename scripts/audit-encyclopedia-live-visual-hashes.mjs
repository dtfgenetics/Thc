#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';

const root=process.cwd();
const input=path.join(root,'data/encyclopedia-visual-approved-assets.json');
if(!fs.existsSync(input)) throw new Error('Approved visual asset ledger missing.');
const assets=JSON.parse(fs.readFileSync(input,'utf8')).assets;
if(!Array.isArray(assets)) throw new Error('Invalid approved visual asset ledger.');
const baseText=process.env.ENCYCLOPEDIA_VISUAL_PUBLIC_BASE_URL;
if(!baseText) throw new Error('Set ENCYCLOPEDIA_VISUAL_PUBLIC_BASE_URL to the verified public infographics directory URL.');
const base=new URL(baseText.endsWith('/')?baseText:baseText+'/');
const local=process.env.ENCYCLOPEDIA_VISUAL_ALLOW_LOCALHOST==='1' && ['localhost','127.0.0.1'].includes(base.hostname);
const publicHost=base.hostname==='dtfseeds.com'||base.hostname.endsWith('.dtfseeds.com');
if(!(base.protocol==='https:'&&publicHost)&&!(local&&base.protocol==='http:')) throw new Error('Public visual URL must use HTTPS on dtfseeds.com; localhost HTTP is reserved for explicit regression fixtures.');
if(base.username||base.password||base.search||base.hash) throw new Error('Public asset base cannot include credentials, query, or fragment.');
const errors=[],items=[],seen=new Set();
if(assets.length===0) errors.push('No approved visuals to verify; live parity cannot be claimed.');
for(const asset of assets){
  const task=`${asset.lessonId}:${asset.visualRole}:${asset.visualOrdinal}`;
  const filename=`${asset.lessonId}_${String(asset.visualOrdinal).padStart(2,'0')}_${asset.visualRole}.png`;
  const expected=`site/wordpress/assets/infographics/${filename}`;
  if(!/^THC-ENC-\d{3,}$/.test(asset.lessonId||'')||!Number.isInteger(asset.visualOrdinal)||asset.visualOrdinal<1||asset.visualOrdinal>10||!/^[a-z0-9][a-z0-9_-]*$/i.test(asset.visualRole||'')||asset.repositoryPath!==expected||!/^[a-f0-9]{64}$/.test(asset.sha256||'')){
    errors.push(`${task}: invalid controlled identity or hash`);continue;
  }
  if(seen.has(task)){errors.push(`${task}: duplicate ledger identity`);continue;}seen.add(task);
  const url=new URL(encodeURIComponent(filename),base);
  try{
    const response=await fetch(url,{redirect:'manual',signal:AbortSignal.timeout(15000),headers:{accept:'image/png'}});
    if(response.status!==200){errors.push(`${task}: HTTP ${response.status} (redirects not accepted)`);continue;}
    const type=response.headers.get('content-type')||'';
    if(!/^image\/png(?:;|$)/i.test(type)){errors.push(`${task}: non-PNG content type ${type}`);continue;}
    const buf=Buffer.from(await response.arrayBuffer());
    if(buf.length>12*1024*1024){errors.push(`${task}: public asset exceeds 12 MiB audit limit`);continue;}
    const digest=crypto.createHash('sha256').update(buf).digest('hex');
    const match=digest===asset.sha256&&buf.length===asset.bytes&&buf.subarray(0,8).toString('hex')==='89504e470d0a1a0a';
    items.push({lessonId:asset.lessonId,visualTaskId:task,url:url.toString(),expectedSha256:asset.sha256,observedSha256:digest,expectedBytes:asset.bytes,observedBytes:buf.length,match});
    if(!match) errors.push(`${task}: published bytes differ from approved asset`);
  }catch(error){errors.push(`${task}: request failed: ${error.message}`);}
}
const output={schemaVersion:'1.0.0',artifactId:'encyclopedia-live-visual-parity',scope:'approved-visual-public-byte-parity',publicBase:base.toString(),summary:{expected:assets.length,checked:items.length,matching:items.filter(x=>x.match).length,failures:errors.length},errors,items};
const out=path.join(root,'data/encyclopedia-live-visual-parity.json');
fs.writeFileSync(out,JSON.stringify(output,null,2)+'\n');
if(errors.length){console.error(errors.join('\n'));process.exit(1);}
console.log(`Live visual parity PASS: ${items.length}/${assets.length} approved visuals matched public bytes.`);
