#!/usr/bin/env node
import fs from 'node:fs';

export function buildGithubSnapshot(queue,pullRequests,{capturedAt='1970-01-01T00:00:00.000Z'}={}){
 const wanted=new Set((queue.items||[]).map(x=>x.pullRequest).filter(Number.isInteger));
 const byNumber={};
 for(const pr of pullRequests||[]){
  if(!wanted.has(pr.number)) continue;
  byNumber[String(pr.number)]={
   state:pr.state,
   merged:Boolean(pr.merged),
   headSha:pr.headSha||null,
   baseSha:pr.baseSha||null,
   url:pr.url||null
  };
 }
 return {schemaVersion:1,capturedAt,pullRequests:byNumber};
}

export function isVerifiedDeploymentState(state){
 return state==='verified'||state==='verified_live';
}

export function buildLiveSnapshot(queue,fingerprints,{capturedAt='1970-01-01T00:00:00.000Z'}={}){
 const wanted=new Set((queue.items||[]).filter(x=>isVerifiedDeploymentState(x.deployment?.state)).map(x=>x.workItemId));
 const out={};
 for(const [id,value] of Object.entries(fingerprints||{})) if(wanted.has(id)) out[id]=value;
 return {schemaVersion:1,capturedAt,workItems:out};
}

if(import.meta.url===new URL('file://'+process.argv[1]).href){
 const [queuePath,inputPath,kind]=process.argv.slice(2);
 if(!queuePath||!inputPath||!['github','live'].includes(kind)) throw new Error('usage: build-project-os-reconciliation-snapshot.mjs queue.json input.json github|live');
 const read=p=>JSON.parse(fs.readFileSync(p,'utf8'));
 const queue=read(queuePath), input=read(inputPath);
 const result=kind==='github'?buildGithubSnapshot(queue,input.pullRequests||input):buildLiveSnapshot(queue,input.workItems||input);
 console.log(JSON.stringify(result,null,2));
}
