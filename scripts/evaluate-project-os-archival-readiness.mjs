#!/usr/bin/env node
import fs from 'node:fs';

export function evaluateArchiveCandidate(doc,repo){
 const row=(doc.candidates||[]).find(x=>x.repo===repo);
 if(!row) throw new Error('archive candidate not found '+repo);
 const missing=[];
 for(const gate of doc.requiredGates||[]){
  const g=row.gates?.[gate];
  if(!g||g.status!=='passed'||!g.evidence) missing.push(gate);
 }
 return {repo,ready:missing.length===0,missing};
}

if(import.meta.url===new URL('file://'+process.argv[1]).href){
 const repo=process.argv[2];
 if(!repo) throw new Error('usage: evaluate-project-os-archival-readiness.mjs owner/repo');
 const doc=JSON.parse(fs.readFileSync('data/project-os/archival-readiness.json','utf8'));
 const result=evaluateArchiveCandidate(doc,repo);
 console.log(JSON.stringify(result,null,2));
 if(!result.ready) process.exit(2);
}
