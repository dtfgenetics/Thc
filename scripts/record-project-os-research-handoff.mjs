#!/usr/bin/env node
import fs from 'node:fs';

export function upsertResearchHandoff(doc,input,now=new Date().toISOString()){
 const next=structuredClone(doc);
 if(!input.handoffId) throw new Error('handoffId required');
 if(!input.workItemId) throw new Error('workItemId required');
 if(!input.question) throw new Error('question required');
 if(!input.deliverable) throw new Error('deliverable required');
 if(!next.allowedStates.includes(input.state||'requested')) throw new Error('invalid state');
 let row=(next.entries||[]).find(x=>x.handoffId===input.handoffId);
 if(!row){
  row={handoffId:input.handoffId,workItemId:input.workItemId,state:input.state||'requested',question:input.question,deliverable:input.deliverable,sourceRequirements:input.sourceRequirements||[],resultRefs:[],createdAt:now,updatedAt:now};
  next.entries.push(row);
 }else{
  if(row.workItemId!==input.workItemId) throw new Error('handoff workItemId is immutable');
  row.state=input.state||row.state;
  row.question=input.question||row.question;
  row.deliverable=input.deliverable||row.deliverable;
  row.updatedAt=now;
 }
 if(input.resultRef && !row.resultRefs.includes(input.resultRef)) row.resultRefs.push(input.resultRef);
 return next;
}

if(import.meta.url===new URL('file://'+process.argv[1]).href){
 const args=process.argv.slice(2);
 const value=name=>{const i=args.indexOf(name);return i>=0?args[i+1]:null};
 const file=value('--file')||'data/project-os/research-handoffs.json';
 const doc=JSON.parse(fs.readFileSync(file,'utf8'));
 const next=upsertResearchHandoff(doc,{
  handoffId:value('--id'),workItemId:value('--work-item'),state:value('--state')||'requested',
  question:value('--question'),deliverable:value('--deliverable'),resultRef:value('--result-ref')
 },process.env.PROJECT_OS_NOW||new Date().toISOString());
 fs.writeFileSync(file,JSON.stringify(next,null,2)+'\n');
 console.log('Research handoff recorded: '+value('--id'));
}
