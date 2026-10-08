#!/usr/bin/env node
import fs from 'node:fs';

export function liveFingerprintWorkItems(queue){
 return (queue.items||[]).filter(item=>['verified','verified_live'].includes(item.deployment?.state)&&item.deployment?.fingerprint);
}
export async function collectLiveFingerprints(queue,{fetchFingerprint}){
 if(typeof fetchFingerprint!=='function') throw new TypeError('fetchFingerprint is required');
 const workItems={};
 for(const item of liveFingerprintWorkItems(queue)){
  const observed=await fetchFingerprint(item);
  if(observed) workItems[item.workItemId]=observed;
 }
 return workItems;
}
export async function fetchJson(url,{fetchImpl=fetch}={}){
 const response=await fetchImpl(url,{headers:{Accept:'application/json','Cache-Control':'no-cache'}});
 if(!response.ok) throw new Error(`live fingerprint request failed: ${response.status}`);
 const value=await response.json();
 if(!value||typeof value!=='object'||Array.isArray(value)) throw new Error('live fingerprint response must be an object');
 if(typeof value.sourceRevision!=='string'||!(/^[0-9a-f]{40}$/i).test(value.sourceRevision)) throw new Error('live fingerprint must include a valid Git sourceRevision');
 return value;
}
if(import.meta.url===new URL('file://'+process.argv[1]).href){
 const [queuePath]=process.argv.slice(2);
 const base=(process.env.PROJECT_OS_LIVE_BASE_URL||'').replace(/\/$/,'');
 if(!queuePath||!base) throw new Error('usage: PROJECT_OS_LIVE_BASE_URL=https://host collect-project-os-live-state.mjs queue.json');
 const queue=JSON.parse(fs.readFileSync(queuePath,'utf8'));
 const fingerprint=await fetchJson(base+'/assets/project-os-release-fingerprint.json');
 const workItems=await collectLiveFingerprints(queue,{fetchFingerprint:async()=>fingerprint});
 console.log(JSON.stringify({workItems},null,2));
}
