#!/usr/bin/env node
import fs from 'node:fs';

const workflows=[
  '.github/workflows/repository-convergence-ci.yml',
  '.github/workflows/dtf420-overlay-shell-ci.yml'
];
const errors=[];

function extractPaths(source,event){
  const lines=source.split(/\r?\n/);
  let active=false;
  let inPaths=false;
  const paths=[];
  for(const line of lines){
    const top=line.match(/^  ([A-Za-z_][A-Za-z0-9_-]*):\s*$/);
    if(top){
      if(active && top[1]!==event) break;
      active=top[1]===event;
      inPaths=false;
      continue;
    }
    if(!active) continue;
    if(/^    paths:\s*$/.test(line)){inPaths=true;continue;}
    if(inPaths){
      const item=line.match(/^      - ['"](.+?)['"]\s*$/);
      if(item){paths.push(item[1]);continue;}
      if(/^    [A-Za-z_][A-Za-z0-9_-]*:\s*/.test(line)) break;
    }
  }
  return paths;
}

for(const workflow of workflows){
  const source=fs.readFileSync(workflow,'utf8');
  const pr=extractPaths(source,'pull_request');
  const push=extractPaths(source,'push');
  const prSet=new Set(pr), pushSet=new Set(push);
  const missingOnPush=[...prSet].filter(x=>!pushSet.has(x));
  const pushOnly=[...pushSet].filter(x=>!prSet.has(x));
  if(!pr.length) errors.push(`${workflow}: pull_request.paths is empty or unreadable`);
  if(!push.length) errors.push(`${workflow}: push.paths is empty or unreadable`);
  if(pr.length!==prSet.size) errors.push(`${workflow}: pull_request.paths contains duplicate entries`);
  if(push.length!==pushSet.size) errors.push(`${workflow}: push.paths contains duplicate entries`);
  if(missingOnPush.length) errors.push(`${workflow}: paths watched on PR but skipped after merge: ${missingOnPush.join(', ')}`);
  if(pushOnly.length) errors.push(`${workflow}: push-only paths drift from PR coverage: ${pushOnly.join(', ')}`);
}

if(errors.length){
  console.error(`Workflow path parity validation failed with ${errors.length} issue(s):`);
  for(const e of errors) console.error(' - '+e);
  process.exit(1);
}
console.log('Workflow path parity valid: critical repository/overlay CI runs on the same file changes before and after merge.');
