#!/usr/bin/env node
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const root=path.dirname(fileURLToPath(import.meta.url));
const tmp=fs.mkdtempSync(path.join(os.tmpdir(),'dtf-research-repair-'));
const records=[
 {issueId:'repeat',owner:'x',resource:'a',acceptanceCriteria:['x'],nextExecutableAction:'audit again',consecutiveNoopInspections:2,severity:5,userImpact:5,confidence:1,readiness:1,cost:1},
 {issueId:'ready-high',owner:'x',resource:'b',acceptanceCriteria:['x'],nextExecutableAction:'repair flow',severity:5,userImpact:5,confidence:1,readiness:1,cost:1},
 {issueId:'ready-low',owner:'x',resource:'c',acceptanceCriteria:['x'],nextExecutableAction:'repair copy',severity:1,userImpact:1,confidence:1,readiness:1,cost:4},
 {issueId:'blocked',owner:'x',resource:'d',acceptanceCriteria:['x'],nextExecutableAction:'repair',blocked:true,severity:10,userImpact:10,confidence:1,readiness:1,cost:1}
];
const file=path.join(tmp,'records.json');
fs.writeFileSync(file,JSON.stringify(records));
const select=spawnSync(process.execPath,[path.join(root,'select-work.mjs'),file,'3'],{encoding:'utf8'});
assert.equal(select.status,0,select.stderr);
const chosen=JSON.parse(select.stdout);
assert.deepEqual(chosen.map(x=>x.issueId),['ready-high','ready-low']);
assert.ok(chosen[0].selectionScore>chosen[1].selectionScore);
const anti=spawnSync(process.execPath,[path.join(root,'detect-repeat-audits.mjs'),file],{encoding:'utf8'});
assert.equal(anti.status,1,'repeat audit detector must fail closed');
const repeats=JSON.parse(anti.stdout);
assert.equal(repeats[0].issueId,'repeat');
assert.equal(repeats[0].decision,'rotate-or-replace-with-executable-action');
const schema=JSON.parse(fs.readFileSync(path.join(root,'../assets/work-record.schema.json'),'utf8'));
for(const field of ['issueId','owner','resource','acceptanceCriteria','nextExecutableAction']) assert.ok(schema.required.includes(field));

const campaignSchema=JSON.parse(fs.readFileSync(path.join(root,'../assets/campaign.schema.json'),'utf8'));
for(const field of ['campaignId','outcome','completionCriteria','jobs','nextExecutableAction']) assert.ok(campaignSchema.required.includes(field));

const eventsFile=path.join(tmp,'events.json');
fs.writeFileSync(eventsFile,JSON.stringify([
 {type:'candidate'},{type:'candidate'},
 {type:'inspection',area:'ci',noop:false},{type:'inspection',area:'visitor',noop:true},
 {type:'issue-confirmed'},{type:'job-attempt'},{type:'repair-complete'},
 {type:'pr-open'},{type:'live-verified'},{type:'unit-complete',count:4}
]));
const summary=spawnSync(process.execPath,[path.join(root,'summarize-run.mjs'),eventsFile],{encoding:'utf8'});
assert.equal(summary.status,0,summary.stderr);
const metrics=JSON.parse(summary.stdout);
assert.equal(metrics.candidatesConsidered,2);
assert.equal(metrics.independentAreasInspected,2);
assert.equal(metrics.substantiveRepairsCompleted,1);
assert.equal(metrics.contentDataUnitsCompleted,4);
assert.equal(metrics.repeatAuditRate,0.5);


const repoRoot=path.resolve(root,'../../../..');
const skill=fs.readFileSync(path.join(root,'../SKILL.md'),'utf8');
const agents=fs.readFileSync(path.join(repoRoot,'AGENTS.md'),'utf8');
const aiContext=fs.readFileSync(path.join(repoRoot,'AI_CONTEXT.md'),'utf8');
assert.match(skill,/scripts\/orchestrator-epic\.mjs/);
assert.match(skill,/scripts\/orchestrator\.mjs/);
assert.match(skill,/Never create a parallel campaign database or scheduler/);
assert.match(skill,/Scheduled GitHub orchestration is reconciliation\/inspection only unless a real executor is attached/);
assert.match(skill,/do not leave approved work stranded at INTEGRATION_READY/);
assert.match(skill,/typed, machine-checkable acceptance criteria/);
assert.match(skill,/classify the failure before retrying/);
assert.match(agents,/dtf-research-repair\/SKILL\.md/);
assert.match(aiContext,/dtf-research-repair\/SKILL\.md/);
assert.match(aiContext,/existing orchestrator epic\/job machinery/);

console.log('dtf-research-repair self-test passed');
