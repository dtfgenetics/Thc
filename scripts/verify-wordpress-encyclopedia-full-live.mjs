#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';

const site=(process.env.WP_SITE_URL||'https://dtfseeds.com').replace(/\/$/,'');
const manifestPath=process.env.ENCYCLOPEDIA_FULL_BATCH_FILE||'site/wordpress/education/encyclopedia/full-420-production-batch.generated.json';
function positiveIntegerSetting(name,fallback){
  const raw=process.env[name];
  if(raw===undefined) return fallback;
  const value=Number(raw);
  if(!Number.isSafeInteger(value)||value<1) throw new Error(`Invalid ${name}: expected a positive integer, got ${JSON.stringify(raw)}`);
  return value;
}
const concurrency=positiveIntegerSetting('ENCYCLOPEDIA_VERIFY_CONCURRENCY',8);
const attempts=positiveIntegerSetting('ENCYCLOPEDIA_VERIFY_ATTEMPTS',4);
const manifest=JSON.parse(fs.readFileSync(manifestPath,'utf8'));
const ids=(manifest.lessonFiles||[]).map(file=>{
  const match=String(file).match(/thc-enc-(\d{3})\.json$/i);
  if(!match) throw new Error(`Invalid encyclopedia lesson path in manifest: ${file}`);
  return `THC-ENC-${match[1]}`;
});
if(!ids.length) throw new Error('Publication manifest contains no lesson IDs.');
const expectedIds=Array.from({length:420},(_,index)=>`THC-ENC-${String(index+1).padStart(3,'0')}`);
const actualIds=new Set(ids);
const missing=expectedIds.filter(id=>!actualIds.has(id));
const unexpected=[...actualIds].filter(id=>!expectedIds.includes(id));
if(ids.length!==420||actualIds.size!==420||missing.length||unexpected.length){
  throw new Error(`Invalid 420-route manifest: entries=${ids.length}, unique=${actualIds.size}, missing=${missing.slice(0,15).join(',')||'none'}, unexpected=${unexpected.slice(0,15).join(',')||'none'}`);
}
const queue=[...ids], failures=[];
const succeeded=[];
const startedAt=new Date().toISOString();
let verified=0;
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
async function verify(id){
  const slug=id.toLowerCase();
  let last='';
  for(let attempt=1;attempt<=attempts;attempt++){
    try{
      const res=await fetch(`${site}/learn/encyclopedia/${slug}/?dtf_full_verify=${Date.now()}-${attempt}`,{headers:{'Cache-Control':'no-cache, no-store, max-age=0','Pragma':'no-cache'},redirect:'follow',signal:AbortSignal.timeout(30_000)});
      const html=await res.text();
      if(!res.ok) throw new Error(`HTTP ${res.status}`);
      const finalPath=new URL(res.url).pathname.replace(/\/+$/,'/');
      if(finalPath!==`/learn/encyclopedia/${slug}/`) throw new Error(`unexpected redirect target: ${finalPath}`);
      if(!html.includes(`data-thc-encyclopedia-id="${id}"`)) throw new Error('missing canonical lesson marker');
      if(!html.includes('Key concepts · Terms to know')) throw new Error('missing key concepts / terms section');
      verified+=1; succeeded.push(id); return;
    }catch(error){last=String(error?.message||error); if(attempt<attempts) await sleep(1200*attempt);}
  }
  failures.push({id,error:last});
}
async function worker(){while(queue.length){const id=queue.shift();if(id)await verify(id);}}
await Promise.all(Array.from({length:concurrency},()=>worker()));
const evidencePath=process.env.ENCYCLOPEDIA_VERIFY_REPORT;
if(evidencePath){
  const report={schemaVersion:1,sourceRevision:process.env.GITHUB_SHA||null,site,startedAt,finishedAt:new Date().toISOString(),expected:ids.length,verified,failed:failures.length,passed:failures.length===0&&verified===420,successfulIds:succeeded.sort(),failures:failures.sort((a,b)=>a.id.localeCompare(b.id))};
  fs.mkdirSync(path.dirname(evidencePath),{recursive:true});
  fs.writeFileSync(evidencePath,JSON.stringify(report,null,2)+'\n');
}
if(failures.length||verified!==ids.length){console.error(`Authorized encyclopedia live verification failed: ${failures.length}/${ids.length} route(s).`);for(const row of failures.slice(0,80))console.error(` - ${row.id}: ${row.error}`);process.exit(1);}
console.log(`Authorized encyclopedia live verification PASS: ${verified}/${ids.length} canonical lesson routes.`);
