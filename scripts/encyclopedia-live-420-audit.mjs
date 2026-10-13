#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import {pathToFileURL} from 'node:url';
import {loadEncyclopediaRegistry} from './lib/encyclopedia-registry.mjs';
import {encyclopediaLessonRoute} from './lib/encyclopedia-routes.mjs';

export const ORIGIN='https://dtfseeds.com';
export function buildCoreRoutes(entries){
  if(!Array.isArray(entries)||entries.length!==420) throw Error('Expected exactly 420 controlled core lessons');
  return entries.map((entry,index)=>{
    const number=index+1;
    const id='THC-ENC-'+String(number).padStart(3,'0');
    if(entry?.id!==id||Number(entry.number)!==number) throw Error('Registry identity mismatch at '+number);
    return {id,path:encyclopediaLessonRoute(number)};
  });
}
export function validateDirectory(html,routes){
  const hrefs=new Set([...html.matchAll(/<a\b[^>]*\bhref\s*=\s*(["'])(.*?)\1[^>]*>/gi)].map(x=>x[2]));
  const missing=routes.filter(route=>!hrefs.has(route.path)).map(route=>route.id);
  return {pass:missing.length===0,missing};
}
export function checkLessonResponse(response,html,route){
  const type=response.headers.get('content-type')||'';
  if(response.status!==200) return 'HTTP '+response.status;
  if(!/^text\/html\b/i.test(type)) return 'unexpected content type: '+type;
  // Evaluate document text, excluding metadata and non-rendered script/template content.
  const content=html.replace(/<head\b[^>]*>[\s\S]*?<\/head>/gi,'')
    .replace(/<(script|style|template)\b[^>]*>[\s\S]*?<\/\1>/gi,'')
    .replace(/<!--[\s\S]*?-->/g,'');
  if(!/<h1\b[^>]*>[\s\S]*?<\/h1>/i.test(content)) return 'missing lesson heading';
  const visibleText=content.replace(/<[^>]+>/g,' ');
  if(!new RegExp('\\b'+route.id+'\\b','i').test(visibleText)) return 'missing lesson-specific ID';
  return null;
}
export async function auditLive({routes,fetchImpl=fetch,concurrency=4,timeoutMs=12000,now=()=>new Date().toISOString()}={}){
  if(!Array.isArray(routes)||!routes.length||
    routes.some(x=>!/^THC-ENC-\d{3}$/.test(x.id)||x.path!=='/learn/encyclopedia/'+x.id.toLowerCase()+'/')||
    new Set(routes.map(x=>x.id)).size!==routes.length) throw Error('Invalid route list');
  if(!Number.isInteger(concurrency)||concurrency<1||concurrency>8) throw Error('Invalid concurrency');
  const fetchPage=async route=>{
    try{
      const response=await fetchImpl(ORIGIN+route,{
        redirect:'manual',signal:AbortSignal.timeout(timeoutMs),
        headers:{Accept:'text/html','User-Agent':'DTF-Encyclopedia-Route-Audit/1.0'}
      });
      const type=response.headers.get('content-type')||'';
      const html=response.status===200&&/^text\/html\b/i.test(type)?(await response.text()).slice(0,2000000):'';
      return {response,html};
    }catch(error){return {error:error?.name==='TimeoutError'?'timeout':'request failure'};}
  };
  const index=await fetchPage('/learn/encyclopedia/');
  const directory=index.error?{pass:false,reason:index.error,missing:[]}:
    index.response.status!==200?{pass:false,reason:'HTTP '+index.response.status,missing:[]}:
    !/^text\/html\b/i.test(index.response.headers.get('content-type')||'')?{pass:false,reason:'unexpected directory content type',missing:[]}:
    validateDirectory(index.html,routes);
  const results=Array(routes.length);let next=0;
  await Promise.all(Array.from({length:Math.min(concurrency,routes.length)},async()=>{
    while(next<routes.length){
      const i=next++,route=routes[i],page=await fetchPage(route.path);
      const reason=page.error||checkLessonResponse(page.response,page.html,route);
      results[i]={id:route.id,path:route.path,status:page.response?.status??null,pass:reason===null,reason};
    }
  }));
  const passing=results.filter(x=>x.pass).length;
  const allPassed=directory.pass&&passing===routes.length;
  const isControlledCore=routes.length===420&&routes.every((route,index)=>route.id==='THC-ENC-'+String(index+1).padStart(3,'0'));
  return {schemaVersion:1,checkedAt:now(),origin:ORIGIN,coverage:isControlledCore?'full-420':'sample',
    scope:'HTTP, canonical URL, lesson ID, heading and directory-link checks only; not browser UX, scientific or visual approval, or deployment attestation',
    total:routes.length,passing,directory,allPassed,full420Passed:isControlledCore&&allPassed,results};
}
if(process.argv[1]&&import.meta.url===pathToFileURL(path.resolve(process.argv[1])).href){
  const args=process.argv.slice(2),full=args.includes('--full'),sampleAt=args.indexOf('--sample');
  if(full===(sampleAt>=0)) throw Error('Specify exactly one of --full or --sample N');
  const all=buildCoreRoutes(loadEncyclopediaRegistry().coreEntries);
  let routes=all;
  if(sampleAt>=0){
    const n=Number(args[sampleAt+1]);
    if(!Number.isInteger(n)||n<1||n>420) throw Error('Sample must be an integer from 1 to 420');
    routes=[...new Set(Array.from({length:n},(_,i)=>Math.round(i*419/Math.max(1,n-1))))].map(i=>all[i]);
  }
  const report=await auditLive({routes});
  const dest=process.env.ENCYCLOPEDIA_LIVE_AUDIT_REPORT||'.artifacts/encyclopedia/live-420-http-audit.json';
  fs.mkdirSync(path.dirname(dest),{recursive:true});
  fs.writeFileSync(dest,JSON.stringify(report,null,2)+'\n');
  console.log(JSON.stringify({checkedAt:report.checkedAt,coverage:report.coverage,total:report.total,passing:report.passing,
    full420Passed:report.full420Passed,directory:report.directory,failures:report.results.filter(x=>!x.pass).slice(0,25)},null,2));
  if(!report.allPassed) process.exitCode=1;
}
