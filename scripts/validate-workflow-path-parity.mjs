#!/usr/bin/env node
import fs from 'node:fs';

const workflows=[
  '.github/workflows/repository-convergence-ci.yml',
  '.github/workflows/dtf420-overlay-shell-ci.yml'
];
const errors=[];

function extractPaths(source,event){
  const eventRe=new RegExp(`^  ${event}:\\n([\\s\\S]*?)(?=^  [a-zA-Z_][a-zA-Z0-9_-]*:|^permissions:|^jobs:|\\Z)`,'m');
  const block=source.match(eventRe)?.[1]||'';
  const pathsBlock=block.match(/^[ ]{4}paths:\n([\s\S]*?)(?=^[ ]{4}[a-zA-Z_][a-zA-Z0-9_-]*:|^\S|\Z)/m)?.[1]||'';
  return pathsBlock.split('\n')
    .map(line=>line.match(/^[ ]{6}- ['"](.+?)['"]\s*$/)?.[1])
    .filter(Boolean);
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
  if(missingOnPush.length) errors.push(`${workflow}: paths watched on PR but skipped after merge: ${missingOnPush.join(', ')}`);
  if(pushOnly.length) errors.push(`${workflow}: push-only paths drift from PR coverage: ${pushOnly.join(', ')}`);
}

if(errors.length){
  console.error(`Workflow path parity validation failed with ${errors.length} issue(s):`);
  for(const e of errors) console.error(' - '+e);
  process.exit(1);
}
console.log('Workflow path parity valid: critical repository/overlay CI runs on the same file changes before and after merge.');
