#!/usr/bin/env node
import fs from 'node:fs';
import {execFileSync} from 'node:child_process';

const rules=JSON.parse(fs.readFileSync('data/project-os/ci-impact-rules.json','utf8'));
const argv=process.argv.slice(2);
const arg=name=>{const i=argv.indexOf(name);return i>=0?argv[i+1]:null};
const norm=s=>String(s||'').replace(/^\.\//,'').replace(/\\/g,'/');
const matches=(file,prefix)=>{const f=norm(file),p=norm(prefix);return p.endsWith('/')?f.startsWith(p):f===p||f.startsWith(p+'/')};
let files=[];
if(arg('--files')) files=arg('--files').split(',').map(norm).filter(Boolean);
else{
  const base=arg('--base')||process.env.GITHUB_BASE_SHA;
  const head=arg('--head')||process.env.GITHUB_SHA||'HEAD';
  const diff=base?execFileSync('git',['diff','--name-only',base+'...'+head],{encoding:'utf8'}):execFileSync('git',['show','--pretty=','--name-only',head],{encoding:'utf8'});
  files=diff.split(/\r?\n/).map(norm).filter(Boolean);
}
const affected=[];
const checks=new Set(rules.defaultChecks||[]);
const broad=new Set();
for(const d of rules.domains){
  const matched=files.filter(f=>d.paths.some(p=>matches(f,p)));
  if(matched.length){
    affected.push({id:d.id,matchedFiles:matched});
    for(const c of d.checks||[]) checks.add(c);
    for(const c of d.broadChecks||[]) broad.add(c);
  }
}
const full=argv.includes('--full')||affected.length>=3;
const narrowChecks=[...checks].sort();
const broadChecks=full?[...broad].sort():[];
const result={schemaVersion:1,changedFiles:files,affectedDomains:affected,fullValidation:full,narrowChecks,broadChecks,checks:[...new Set([...narrowChecks,...broadChecks])]};
console.log(JSON.stringify(result,null,2));
