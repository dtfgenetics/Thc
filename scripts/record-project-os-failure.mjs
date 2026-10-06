#!/usr/bin/env node
import fs from 'node:fs';

export function upsertFailure(doc,input,now=new Date().toISOString()){
 const next=structuredClone(doc);
 if(!input.fingerprint) throw new Error('fingerprint required');
 if(!input.rootCause) throw new Error('rootCause required');
 let row=(next.entries||[]).find(x=>x.fingerprint===input.fingerprint);
 if(!row){
  row={
   fingerprint:input.fingerprint,
   category:input.category||'unknown',
   rootCause:input.rootCause,
   occurrences:0,
   firstSeenAt:now,
   lastSeenAt:now,
   affectedProjects:[],
   successfulRepairs:[],
   invalidatedWorkarounds:[],
   references:[]
  };
  next.entries.push(row);
 }
 row.occurrences=(row.occurrences||0)+1;
 row.lastSeenAt=now;
 row.rootCause=input.rootCause||row.rootCause;
 for(const [key,value] of [
  ['affectedProjects',input.project],
  ['successfulRepairs',input.successfulRepair],
  ['invalidatedWorkarounds',input.invalidatedWorkaround],
  ['references',input.reference]
 ]){
  if(value && !row[key].includes(value)) row[key].push(value);
 }
 return next;
}

if(import.meta.url===new URL('file://'+process.argv[1]).href){
 const args=process.argv.slice(2);
 const value=name=>{const i=args.indexOf(name);return i>=0?args[i+1]:null};
 const file=value('--file')||'data/project-os/failure-memory.json';
 const doc=JSON.parse(fs.readFileSync(file,'utf8'));
 const next=upsertFailure(doc,{
  fingerprint:value('--fingerprint'),
  category:value('--category'),
  rootCause:value('--root-cause'),
  project:value('--project'),
  successfulRepair:value('--repair'),
  invalidatedWorkaround:value('--invalidated-workaround'),
  reference:value('--reference')
 },process.env.PROJECT_OS_NOW||new Date().toISOString());
 fs.writeFileSync(file,JSON.stringify(next,null,2)+'\n');
 console.log('Failure memory recorded: '+value('--fingerprint'));
}
