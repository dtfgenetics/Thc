#!/usr/bin/env node
import fs from 'node:fs';
import {reconcile} from './reconcile-project-os-state.mjs';

export function buildReport(queue,githubSnapshot,liveSnapshot,{generatedAt='1970-01-01T00:00:00.000Z',sourceRevision=null}={}){
 const github=githubSnapshot.pullRequests?githubSnapshot:{pullRequests:{}};
 const live=liveSnapshot.workItems||liveSnapshot;
 const result=reconcile(queue,github,live);
 return {schemaVersion:1,generatedAt,sourceRevision,ok:result.ok,summary:result.summary,drift:result.items.filter(x=>!x.ok)};
}
if(import.meta.url===new URL('file://'+process.argv[1]).href){
 const [queuePath,githubPath,livePath]=process.argv.slice(2);
 if(!queuePath||!githubPath||!livePath) throw new Error('usage: generate-project-os-reconciliation-report.mjs queue.json github.json live.json');
 const read=p=>JSON.parse(fs.readFileSync(p,'utf8'));
 const report=buildReport(read(queuePath),read(githubPath),read(livePath),{generatedAt:process.env.PROJECT_OS_CAPTURED_AT||'1970-01-01T00:00:00.000Z',sourceRevision:process.env.GITHUB_SHA||null});
 console.log(JSON.stringify(report,null,2));
 if(!report.ok) process.exitCode=1;
}
