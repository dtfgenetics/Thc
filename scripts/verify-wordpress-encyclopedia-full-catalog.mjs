#!/usr/bin/env node
import { readFile, writeFile } from 'node:fs/promises';

const base=(process.env.WP_SITE_URL||'https://dtfseeds.com').replace(/\/$/,'');
const manifestPath=process.env.ENCYCLOPEDIA_BATCH_FILE||process.argv[2];
if(!manifestPath) throw new Error('Missing full catalog manifest path.');
const manifest=JSON.parse(await readFile(manifestPath,'utf8'));
if(!Array.isArray(manifest.lessonFiles)||manifest.lessonFiles.length!==420) throw new Error('Full catalog verifier requires exactly 420 lesson files.');
const timeout=Math.max(5000,Number(process.env.ENC_FULL_VERIFY_TIMEOUT_MS||25000));
const concurrency=Math.max(1,Math.min(24,Number(process.env.ENC_FULL_VERIFY_CONCURRENCY||12)));
const rows=manifest.lessonFiles.map((file,index)=>({file,id:`THC-ENC-${String(index+1).padStart(3,'0')}`}));
let cursor=0;
const results=new Array(rows.length);
async function worker(){
  while(true){
    const i=cursor++;
    if(i>=rows.length) return;
    const row=rows[i];
    const slug=row.id.toLowerCase();
    const url=`${base}/learn/encyclopedia/${slug}/?dtf_full_catalog_verify=${Date.now()}-${i}`;
    try{
      const response=await fetch(url,{redirect:'follow',signal:AbortSignal.timeout(timeout),headers:{'user-agent':'DTF-Encyclopedia-Full-Catalog-Verify/1.0','cache-control':'no-cache, no-store'}});
      const body=await response.text();
      results[i]={...row,url,status:response.status,passed:response.status===200&&body.toUpperCase().includes(row.id)};
    }catch(error){
      results[i]={...row,url,status:0,passed:false,error:error instanceof Error?error.message:String(error)};
    }
  }
}
await Promise.all(Array.from({length:concurrency},()=>worker()));
const failed=results.filter(x=>!x.passed);
const index=await fetch(`${base}/learn/encyclopedia/?dtf_full_catalog_verify=${Date.now()}`,{redirect:'follow',signal:AbortSignal.timeout(timeout),headers:{'cache-control':'no-cache, no-store'}});
const indexBody=await index.text();
const indexIds=[...indexBody.matchAll(/THC-ENC-(\d{3})/gi)].map(m=>m[0].toUpperCase());
const uniqueIndexIds=new Set(indexIds.filter(id=>/^THC-ENC-\d{3}$/.test(id)));
const report={generatedAt:new Date().toISOString(),baseUrl:base,expected:420,passed:results.length-failed.length,failed:failed.length,indexStatus:index.status,indexUniqueLessonIds:uniqueIndexIds.size,failedRoutes:failed};
await writeFile('full-encyclopedia-live-verification.json',JSON.stringify(report,null,2)+'\n');
console.log(JSON.stringify(report,null,2));
if(failed.length||index.status!==200||uniqueIndexIds.size<420) process.exit(1);
