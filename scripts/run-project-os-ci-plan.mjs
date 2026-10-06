#!/usr/bin/env node
import {spawnSync} from 'node:child_process';

const argv=process.argv.slice(2);
const filesIndex=argv.indexOf('--files');
const files=filesIndex>=0?argv[filesIndex+1]:null;
const plannerArgs=['scripts/plan-project-os-ci.mjs'];
if(files) plannerArgs.push('--files',files);
if(argv.includes('--full')) plannerArgs.push('--full');
const planned=spawnSync(process.execPath,plannerArgs,{encoding:'utf8'});
if(planned.status!==0){process.stderr.write(planned.stderr);process.exit(planned.status??1)}
const plan=JSON.parse(planned.stdout);
console.log(JSON.stringify(plan,null,2));
if(!argv.includes('--execute')) process.exit(0);
for(const stage of ['narrowChecks','broadChecks']){
  for(const script of plan[stage]||[]){
    console.log('\n[project-os-ci] '+stage+': npm run '+script);
    const r=spawnSync('npm',['run',script],{stdio:'inherit',shell:false});
    if(r.status!==0) process.exit(r.status??1);
  }
}
