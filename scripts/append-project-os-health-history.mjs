#!/usr/bin/env node
import fs from 'node:fs';

export function appendHistory(history,report,{maxEntries=168}={}){
 const rows=Array.isArray(history)?structuredClone(history):[];
 const key=report.generatedAt;
 const existing=rows.findIndex(x=>x.generatedAt===key);
 const record={
  generatedAt:report.generatedAt,
  queue:report.queue,
  failureMemory:report.failureMemory,
  blockers:report.blockers,
  slos:{pass:report.slos.pass,fail:report.slos.fail,unknown:report.slos.unknown}
 };
 if(existing>=0) rows[existing]=record;
 else rows.push(record);
 rows.sort((a,b)=>String(a.generatedAt).localeCompare(String(b.generatedAt)));
 return rows.slice(-maxEntries);
}

if(import.meta.url===new URL('file://'+process.argv[1]).href){
 const reportPath=process.argv[2];
 const historyPath=process.argv[3]||'data/project-os/health-history.json';
 if(!reportPath) throw new Error('usage: append-project-os-health-history.mjs report.json [history.json]');
 const report=JSON.parse(fs.readFileSync(reportPath,'utf8'));
 const history=fs.existsSync(historyPath)?JSON.parse(fs.readFileSync(historyPath,'utf8')):[];
 const next=appendHistory(history,report);
 fs.writeFileSync(historyPath,JSON.stringify(next,null,2)+'\n');
 console.log('Project OS health history entries: '+next.length);
}
