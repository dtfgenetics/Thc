#!/usr/bin/env node
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {spawnSync} from 'node:child_process';

const validator=path.resolve('scripts/validate-project-os-work-queue.mjs');
const base={
 schemaVersion:1,
 items:[{
  workItemId:'a',project:'platform',ownerRepo:'dtfgenetics/Thc',
  state:'queued',dependencies:[],acceptanceCriteria:[{id:'x',status:'pending'}],
  branch:null,lease:null
 }]
};
function run(name,mutate,expectOk){
 const q=structuredClone(base); mutate(q);
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),'project-os-queue-'));
 const file=path.join(dir,'queue.json'); fs.writeFileSync(file,JSON.stringify(q));
 const r=spawnSync(process.execPath,[validator,file],{encoding:'utf8',env:{...process.env,PROJECT_OS_NOW:'2026-10-06T02:30:00Z'}});
 fs.rmSync(dir,{recursive:true,force:true});
 const ok=r.status===0;
 if(ok!==expectOk){
  console.error(name+' failed expectation\nstdout: '+r.stdout+'\nstderr: '+r.stderr);
  process.exitCode=1;
 } else console.log('ok - '+name);
}
run('valid queued item',()=>{},true);
run('duplicate work ids',q=>q.items.push(structuredClone(q.items[0])),false);
run('active branch collision',q=>{
 q.items[0].state='review'; q.items[0].branch='work/x';
 const b=structuredClone(q.items[0]); b.workItemId='b'; q.items.push(b);
},false);
run('expired active lease',q=>{
 q.items[0].state='in_progress'; q.items[0].branch='work/a';
 q.items[0].lease={worker:'agent-a',expiresAt:'2026-10-06T02:29:59Z'};
},false);
run('fresh active lease',q=>{
 q.items[0].state='in_progress'; q.items[0].branch='work/a';
 q.items[0].lease={worker:'agent-a',expiresAt:'2026-10-06T03:30:00Z'};
},true);
run('done with unmet acceptance',q=>{q.items[0].state='done';},false);
if(process.exitCode) process.exit(process.exitCode);
console.log('Project OS work queue fixture tests passed');
