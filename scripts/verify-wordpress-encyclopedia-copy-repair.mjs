#!/usr/bin/env node
import fs from 'node:fs';

const scanPath='/tmp/encyclopedia-copy-repair-scan.json';
const auditPath='live-encyclopedia-copy-audit.json';
if(!fs.existsSync(scanPath)) throw new Error('Missing copy-repair scan report.');
if(!fs.existsSync(auditPath)) throw new Error('Missing live encyclopedia copy audit report.');
const scan=JSON.parse(fs.readFileSync(scanPath,'utf8'));
const audit=JSON.parse(fs.readFileSync(auditPath,'utf8'));
const blocked=new Map((scan.blocked||[]).map(x=>[x.id,x]));
const unexpected=[];
for(const route of audit.failedRoutes||[]){
  const hold=blocked.get(route.id);
  if(!hold || hold.reason!=='publication-hold') unexpected.push(route);
}
const repairedButStillFailing=(scan.candidates||[]).filter(x=>(audit.failedRoutes||[]).some(r=>r.id===x.id));
if(repairedButStillFailing.length) unexpected.push(...repairedButStillFailing.map(x=>({id:x.id,reason:'repairable-route-still-failing'})));
const summary={
  auditFailures:Number(audit.failures||0),
  blockedPublicationHolds:blocked.size,
  unexpectedFailures:unexpected.length,
  eligibleRepairs:Number(scan.repairableDefects||scan.candidates?.length||0),
  passed:unexpected.length===0
};
console.log(JSON.stringify(summary,null,2));
if(unexpected.length){
  console.error('Unexpected live encyclopedia copy failures remain:');
  unexpected.slice(0,100).forEach(x=>console.error(` - ${x.id}: ${x.reason||x.defects?.join(', ')||'unknown'}`));
  process.exit(1);
}
console.log(`Live copy reconciliation PASS: ${audit.failures||0} audit failure(s) are covered by ${blocked.size} explicit publication hold(s); no repairable drift remains.`);
