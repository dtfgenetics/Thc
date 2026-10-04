#!/usr/bin/env node
import { readFile, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { readCanonicalEncyclopediaLessons } from './lib/encyclopedia-canonical-lessons.mjs';
import { effectiveLessonAssessment } from './lib/encyclopedia-assessment-v2.mjs';

const BASE_URL=(process.env.DTF_SITE_URL||'https://dtfseeds.com').replace(/\/$/,'');
const REGISTRY='content/encyclopedia/current-controlled-registry.json';
const OUT='live-encyclopedia-copy-audit.json';
const CONCURRENCY=Math.max(1,Math.min(24,Number(process.env.ENC_LIVE_AUDIT_CONCURRENCY||6)));
const TIMEOUT=Math.max(5000,Number(process.env.ENC_LIVE_AUDIT_TIMEOUT_MS||25000));
const ATTEMPTS=Math.max(1,Math.min(5,Number(process.env.ENC_LIVE_AUDIT_ATTEMPTS||3)));
const sleep=ms=>new Promise(resolve=>setTimeout(resolve,ms));

const registry=JSON.parse(await readFile(REGISTRY,'utf8'));
const entries=Array.isArray(registry.entries)?registry.entries:[];
const canonical=readCanonicalEncyclopediaLessons(process.cwd());
const canonicalById=new Map(canonical.map(lesson=>[lesson.id,lesson]));
const fingerprintOf=a=>createHash('sha256').update(JSON.stringify({id:a.id,title:a.title,objective:a.objective,terms:a.terms,coreScience:a.coreScience,cultivationRelevance:a.cultivationRelevance,measureAndRecord:a.measureAndRecord,misconceptions:a.misconceptions,evidenceLimits:a.evidenceLimits,crossLinks:a.crossLinks,sourceNotes:a.sourceNotes,assessment:effectiveLessonAssessment(a).prompts})).digest('hex').slice(0,24);
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
  const lesson=canonicalById.get(id);
  const expectedFingerprint=lesson?fingerprintOf(lesson):null;
  const slug=id.toLowerCase();
  let lastError='';
  for(let attempt=1;attempt<=ATTEMPTS;attempt++){
    const url=`${BASE_URL}/learn/encyclopedia/${slug}/?dtf_live_copy_audit=${Date.now()}-${attempt}`;
    try{
      const response=await fetch(url,{
        redirect:'follow',
        signal:AbortSignal.timeout(TIMEOUT),
        headers:{
          'user-agent':'DTF-Encyclopedia-Live-Copy-Audit/2.0',
          'cache-control':'no-cache, no-store, max-age=0',
          pragma:'no-cache'
        }
      });
      const body=await response.text();
      const text=decodeHtml(body);
      const fingerprintMatch=body.match(/data-thc-source-fingerprint=["']([0-9a-f]{24})["']/i);
      const liveFingerprint=fingerprintMatch?.[1]||null;
      const matched=defects.filter(d=>d.re.test(text));
      const found=matched.map(d=>d.id);
      if(response.status===200&&expectedFingerprint&&liveFingerprint!==expectedFingerprint) found.push(liveFingerprint?'source-fingerprint-mismatch':'source-fingerprint-missing');
      const defectSnippets=matched.map(d=>{
        const match=text.match(d.re);
        const index=match?.index??-1;
        const snippetStart=Math.max(0,index-240);
        const snippetEnd=Math.min(text.length,index+(match?.[0]?.length||0)+240);
        return {id:d.id,snippet:index>=0?text.slice(snippetStart,snippetEnd):null};
      });
      if(response.status===200||response.status===404){
        return {id,url,status:response.status,live:response.status===200,expectedFingerprint,liveFingerprint,fingerprintMatch:response.status===200?liveFingerprint===expectedFingerprint:null,defects:found,defectSnippets,attempts:attempt,passed:response.status===404||response.status===200&&found.length===0};
      }
      lastError=`HTTP ${response.status}`;
    }catch(error){
      lastError=error instanceof Error?error.message:String(error);
    }
    if(attempt<ATTEMPTS) await sleep(500*attempt);
  }
  const url=`${BASE_URL}/learn/encyclopedia/${slug}/`;
  return {id,url,status:0,live:false,defects:['fetch-failure'],attempts:ATTEMPTS,error:lastError,passed:false};
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
  defectCounts:{...Object.fromEntries(defects.map(d=>[d.id,failures.filter(r=>r.defects.includes(d.id)).length])),sourceFingerprintMissing:failures.filter(r=>r.defects.includes('source-fingerprint-missing')).length,sourceFingerprintMismatch:failures.filter(r=>r.defects.includes('source-fingerprint-mismatch')).length},
  failedRoutes:failures,
  passed:failures.length===0
};
await writeFile(OUT,JSON.stringify(report,null,2)+'\n','utf8');
console.log(JSON.stringify(report,null,2));
if(!report.passed) process.exitCode=1;
