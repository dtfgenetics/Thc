#!/usr/bin/env node
import fs from 'node:fs';
const file=process.argv[2];
if(!file){console.error('usage: node summarize-run.mjs <run-events.json>');process.exit(2);}
const events=JSON.parse(fs.readFileSync(file,'utf8'));
if(!Array.isArray(events)) throw new Error('expected an array of run events');
const count=t=>events.filter(e=>e.type===t).length;
const inspections=count('inspection');
const noops=events.filter(e=>e.type==='inspection'&&e.noop).length;
const out={
 candidatesConsidered:count('candidate'),
 independentAreasInspected:new Set(events.filter(e=>e.type==='inspection').map(e=>e.area).filter(Boolean)).size,
 confirmedIssues:count('issue-confirmed'),
 readyJobsAttempted:count('job-attempt'),
 substantiveRepairsCompleted:count('repair-complete'),
 prsOpenedOrUpdated:events.filter(e=>['pr-open','pr-update'].includes(e.type)).length,
 prsMerged:count('pr-merge'),
 deploymentsVerified:count('deployment-verified'),
 liveVerifications:count('live-verified'),
 contentDataUnitsCompleted:events.filter(e=>e.type==='unit-complete').reduce((n,e)=>n+(Number(e.count)||1),0),
 blockedJobsAdvanced:count('blocked-advanced'),
 repeatedNoopInspections:noops,
 repeatAuditRate:inspections ? Number((noops/inspections).toFixed(4)) : 0
};
process.stdout.write(JSON.stringify(out,null,2)+'\n');
