#!/usr/bin/env node
// Non-destructive HTTP smoke checks for explicitly listed public production routes.
import fs from 'node:fs';
import { pathToFileURL } from 'node:url';

export function validateTargets(targets) {
  if (!Array.isArray(targets) || targets.length === 0) return ['targets must be a non-empty array'];
  const errors=[];
  for(const [i,t] of targets.entries()){
    if (!t || typeof t !== 'object' || typeof t.name !== 'string' || !t.name.trim()) errors.push(`target ${i}: name required`);
    try { const u=new URL(t?.url); if (u.protocol!=='https:' || u.hostname!=='dtfseeds.com') throw Error(); }
    catch {errors.push(`target ${i}: URL must use https://dtfseeds.com`);}
    if(t?.mustContain!==undefined && (typeof t.mustContain!=='string' || !t.mustContain.length)) errors.push(`target ${i}: mustContain must be nonempty text`);
  }
  return errors;
}
export async function probe(targets, fetcher=fetch) {
  const bad=validateTargets(targets);
  if(bad.length) throw new Error(bad.join('; '));
  return Promise.all(targets.map(async target=>{
    try {
      const response=await fetcher(target.url,{method:'GET',redirect:'follow',signal:AbortSignal.timeout(12000)});
      // A CDN error page, off-site redirect, or JSON response is not a healthy HTML route.
      const finalUrl = response.url || target.url;
      let safeFinalUrl = false;
      try { const u = new URL(finalUrl); safeFinalUrl = u.protocol === 'https:' && u.hostname === 'dtfseeds.com'; } catch {}
      const contentType = response.headers?.get?.('content-type') || '';
      const html = !contentType || /text\\/html/i.test(contentType);
      const body = await response.text();
      const matches = !target.mustContain || body.includes(target.mustContain);
      const ok = response.ok && safeFinalUrl && html && matches;
      const reason = !response.ok ? 'HTTP error' : !safeFinalUrl ? 'unexpected redirect destination' : !html ? 'unexpected content type' : !matches ? 'expected content missing' : 'ok';
      return {name:target.name,url:target.url,finalUrl,status:response.status,ok,reason};
    }catch(e){return {name:target.name,url:target.url,status:null,ok:false,reason:'network/timeout failure: '+e.message};}
  }));
}
if(process.argv[1] && import.meta.url===pathToFileURL(process.argv[1]).href){
  try {
    if(!process.argv[2]) throw Error('Usage: node scripts/smoke-public-routes.mjs <targets.json>');
    const targets=JSON.parse(fs.readFileSync(process.argv[2],'utf8'));
    const results=await probe(targets);
    console.log(JSON.stringify({checkedAt:new Date().toISOString(),results},null,2));
    if(results.some(x=>!x.ok)) process.exitCode=1;
  } catch(e){console.error(e.message);process.exitCode=2;}
}
