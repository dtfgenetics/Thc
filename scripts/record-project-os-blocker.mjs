#!/usr/bin/env node
import fs from 'node:fs';

export function upsertBlocker(doc,input,now=new Date().toISOString()){
 const next=structuredClone(doc);
 if(!input.blockerId) throw new Error('blockerId required');
 if(!next.allowedTypes.includes(input.type)) throw new Error('invalid blocker type '+input.type);
 if(!input.requiredAction) throw new Error('requiredAction required');
 let row=(next.entries||[]).find(x=>x.blockerId===input.blockerId);
 if(!row){
  row={blockerId:input.blockerId,workItemId:input.workItemId||null,type:input.type,humanOnly:Boolean(input.humanOnly),state:'open',requiredAction:input.requiredAction,createdAt:now,updatedAt:now,resolvedAt:null,evidence:[]};
  next.entries.push(row);
 }else{
  row.type=input.type;
  row.humanOnly=Boolean(input.humanOnly);
  row.requiredAction=input.requiredAction;
  row.updatedAt=now;
  if(row.state==='resolved'){row.state='open';row.resolvedAt=null;}
 }
 if(input.evidence&&!row.evidence.includes(input.evidence)) row.evidence.push(input.evidence);
 return next;
}

export function resolveBlocker(doc,blockerId,now=new Date().toISOString()){
 const next=structuredClone(doc);
 const row=(next.entries||[]).find(x=>x.blockerId===blockerId);
 if(!row) throw new Error('blocker not found '+blockerId);
 row.state='resolved'; row.resolvedAt=now; row.updatedAt=now;
 return next;
}

if(import.meta.url===new URL('file://'+process.argv[1]).href){
 const args=process.argv.slice(2);
 const value=name=>{const i=args.indexOf(name);return i>=0?args[i+1]:null};
 const file=value('--file')||'data/project-os/blocker-escalation.json';
 const doc=JSON.parse(fs.readFileSync(file,'utf8'));
 const id=value('--id');
 let next;
 if(args.includes('--resolve')) next=resolveBlocker(doc,id,process.env.PROJECT_OS_NOW||new Date().toISOString());
 else next=upsertBlocker(doc,{
  blockerId:id,workItemId:value('--work-item'),type:value('--type'),
  humanOnly:args.includes('--human-only'),requiredAction:value('--required-action'),evidence:value('--evidence')
 },process.env.PROJECT_OS_NOW||new Date().toISOString());
 fs.writeFileSync(file,JSON.stringify(next,null,2)+'\n');
 console.log((args.includes('--resolve')?'Resolved':'Recorded')+' blocker '+id);
}
