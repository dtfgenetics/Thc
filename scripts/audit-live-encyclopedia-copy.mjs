#!/usr/bin/env node
import { readFile, writeFile } from 'node:fs/promises';

const BASE_URL=(process.env.DTF_SITE_URL||'https://dtfseeds.com').replace(/\/$/,'');
const REGISTRY='content/encyclopedia/current-controlled-registry.json';
const OUT='live-encyclopedia-copy-audit.json';
const CONCURRENCY=Math.max(1,Math.min(24,Number(process.env.ENC_LIVE_AUDIT_CONCURRENCY||10)));
const TIMEOUT=Math.max(5000,Number(process.env.ENC_LIVE_AUDIT_TIMEOUT_MS||20000));

const registry=JSON.parse(await readFile(REGISTRY,'utf8'));
const entries=Array.isArray(registry.entries)?registry.entries:[];
if(entries.length!==420) throw new Error(`Expected 420 controlled encyclopedia entries; found ${entries.length}`);

const defects=[
  {id:'malformed-source-label',re:/\b(?:Open|ppen) sourc(?:\b|ee\b)|\bsourcee\b|\babstracte\b/i},
  {id:'generic-misconception-placeholder',re:/Correction:\s*See the (?:controlled )?lesson evidence and context\.?/i}
];

function decodeHtml(value=''){
  return String(value)
    .replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi,' ')
    .replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi,' ')
    .replace(/<[^>]+>/g,' ')
    .replaceAll('&nbsp;',' ')
    .replaceAll('&amp;','&')
    .replaceAll('&quot;','"')
    .replaceAll('&#39;',"'")
    .replace(/\s+/g,' ')
    .trim();
}

async function fetchRoute(id){
  const slug=id.toLowerCase();
  const url=`${BASE_URL}/learn/encyclopedia/${slug}/?dtf_live_copy_audit=${Date.now()}`;
  try{
    const response=await fetch(url,{
      redirect:'follow',
      signal:AbortSignal.timeout(TIMEOUT),
      headers:{'user-agent':'DTF-Encyclopedia-Live-Copy-Audit/1.0','cache-control':'no-cache'}
    });
    const body=await response.text();
    const text=decodeHtml(body);
    const matched=defects.filter(d=>d.re.test(text));
    const found=matched.map(d=>d.id);
    const defectSnippets=matched.map(d=>{
      const match=text.match(d.re);
      const index=match?.index??-1;
      const start=Math.max(0,index-240);
      const end=Math.min(text.length,index+(match?.[0]?.length||0)+240);
      return {id:d.id,snippet:index>=0?text.slice(start,end):null};
    });
    return {id,url,status:response.status,live:response.status===200,defects:found,defectSnippets,passed:response.status===404||response.status===200&&found.length===0};
  }catch(error){
    return {id,url,status:0,live:false,defects:['fetch-failure'],error:error instanceof Error?error.message:String(error),passed:false};
  }
}

const results=new Array(entries.length);
let next=0;
async function worker(){
  while(true){
    const index=next++;
    if(index>=entries.length) return;
    results[index]=await fetchRoute(entries[index].id);
  }
}
await Promise.all(Array.from({length:CONCURRENCY},()=>worker()));

const live=results.filter(r=>r.live);
const failures=results.filter(r=>!r.passed);
const report={
  generatedAt:new Date().toISOString(),
  baseUrl:BASE_URL,
  controlledEntries:entries.length,
  livePages:live.length,
  unpublished404:results.filter(r=>r.status===404).length,
  failures:failures.length,
  defectCounts:Object.fromEntries(defects.map(d=>[d.id,failures.filter(r=>r.defects.includes(d.id)).length])),
  failedRoutes:failures,
  passed:failures.length===0
};
await writeFile(OUT,JSON.stringify(report,null,2)+'\n','utf8');
console.log(JSON.stringify(report,null,2));
if(!report.passed) process.exitCode=1;
