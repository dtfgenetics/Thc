#!/usr/bin/env node
import fs from 'node:fs';
const inputPath=process.argv[2];
if(!inputPath){console.error('usage: node detect-repeat-audits.mjs <work-records.json>');process.exit(2);}
const records=JSON.parse(fs.readFileSync(inputPath,'utf8'));
const repeats=records.filter(r=>(r.consecutiveNoopInspections||0)>=2).map(r=>({
 issueId:r.issueId,
 resource:r.resource,
 consecutiveNoopInspections:r.consecutiveNoopInspections,
 nextExecutableAction:r.nextExecutableAction,
 decision:/inspect|audit/i.test(r.nextExecutableAction||'')?'rotate-or-replace-with-executable-action':'execute-next-action'
}));
process.stdout.write(JSON.stringify(repeats,null,2)+'\n');
if(repeats.some(r=>r.decision==='rotate-or-replace-with-executable-action')) process.exitCode=1;
