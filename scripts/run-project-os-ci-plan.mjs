#!/usr/bin/env node
import {spawnSync} from 'node:child_process';

const argv=process.argv.slice(2);
const filesIndex=argv.indexOf('--files');
const files=filesIndex>=0?argv[filesIndex+1]:null;
const stageIndex=argv.indexOf('--stage');
const stage=stageIndex>=0?argv[stageIndex+1]:'all';
if(!['all','narrow','broad'].includes(stage)) throw new Error('--stage must be all, narrow, or broad');
const plannerArgs=['scripts/plan-project-os-ci.mjs'];
if(files) plannerArgs.push('--files',files);
if(argv.includes('--full')) plannerArgs.push('--full');
const planned=spawnSync(process.execPath,plannerArgs,{encoding:'utf8'});
if(planned.status!==0){process.stderr.write(planned.stderr);process.exit(planned.status??1)}
const plan=JSON.parse(planned.stdout);
console.log(JSON.stringify(plan,null,2));
if(!argv.includes('--execute')) process.exit(0);
const stages=stage==='all'?['narrowChecks','broadChecks']:[stage==='narrow'?'narrowChecks':'broadChecks'];
for(const key of stages){
  for(const script of plan[key]||[]){
    console.log('\n[project-os-ci] '+key+': npm run '+script);
    const r=spawnSync('npm',['run',script],{stdio:'inherit',shell:false});
    if(r.status!==0) process.exit(r.status??1);
  }
}
