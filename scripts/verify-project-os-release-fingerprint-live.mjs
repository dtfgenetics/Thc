#!/usr/bin/env node
import fs from 'node:fs';
import {verifyFingerprint} from './reconcile-project-os-deployment.mjs';

export async function fetchJsonWithRetry(url,{attempts=6,delayMs=5000,fetchImpl=fetch}={}){
 let last;
 for(let i=0;i<attempts;i++){
  try{
   const sep=url.includes('?')?'&':'?';
   const res=await fetchImpl(url+sep+'project_os_verify='+Date.now(),{headers:{'cache-control':'no-cache, no-store, max-age=0'}});
   if(!res.ok) throw new Error('HTTP '+res.status);
   return await res.json();
  }catch(err){
   last=err;
   if(i+1<attempts) await new Promise(r=>setTimeout(r,delayMs));
  }
 }
 throw last;
}

export async function verifyLive({expectedPath,url,fetchImpl=fetch}){
 const contract=JSON.parse(fs.readFileSync('data/project-os/deployment-fingerprint-contract.json','utf8'));
 const expected=JSON.parse(fs.readFileSync(expectedPath,'utf8'));
 const observed=await fetchJsonWithRetry(url,{fetchImpl});
 const errors=verifyFingerprint(contract,expected,observed);
 return {expected,observed,errors};
}

if(import.meta.url===new URL('file://'+process.argv[1]).href){
 const expectedPath=process.argv[2];
 const url=process.argv[3]||'https://dtfseeds.com/assets/project-os-release-fingerprint.json';
 if(!expectedPath) throw new Error('usage: verify-project-os-release-fingerprint-live.mjs expected.json [url]');
 const {observed,errors}=await verifyLive({expectedPath,url});
 if(errors.length){console.error(errors.join('\n'));process.exit(1)}
 console.log('Project OS live release fingerprint verified: '+observed.sourceRevision+' build '+observed.buildId);
}
