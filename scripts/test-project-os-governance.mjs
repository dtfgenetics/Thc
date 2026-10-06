#!/usr/bin/env node
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {upsertResearchHandoff} from './record-project-os-research-handoff.mjs';
import {evaluateArchiveCandidate} from './evaluate-project-os-archival-readiness.mjs';
import {validateGovernance} from './validate-project-os-governance.mjs';

const research=JSON.parse(fs.readFileSync('data/project-os/research-handoffs.json','utf8'));
const security=JSON.parse(fs.readFileSync('data/project-os/security-maintenance.json','utf8'));
const archival=JSON.parse(fs.readFileSync('data/project-os/archival-readiness.json','utf8'));
assert.deepEqual(validateGovernance({research,security,archival}),[]);

let r=upsertResearchHandoff(research,{handoffId:'h1',workItemId:'w1',question:'Find authoritative source',deliverable:'Source packet',state:'requested'},'2026-10-06T10:40:00Z');
r=upsertResearchHandoff(r,{handoffId:'h1',workItemId:'w1',question:'Find authoritative source',deliverable:'Source packet',state:'completed',resultRef:'doi:example'},'2026-10-06T10:41:00Z');
assert.equal(r.entries.length,1);
assert.equal(r.entries[0].state,'completed');
assert.deepEqual(r.entries[0].resultRefs,['doi:example']);
assert.throws(()=>upsertResearchHandoff(r,{handoffId:'h1',workItemId:'other',question:'x',deliverable:'y'}),/immutable/);

const badSecurity=structuredClone(security);
badSecurity.repositories[0].state='verified';
badSecurity.repositories[0].evidence=[];
assert.ok(validateGovernance({research,security:badSecurity,archival}).some(x=>x.includes('cannot be verified without evidence')));

const badArchive=structuredClone(archival);
badArchive.candidates[0].state='ready';
assert.ok(validateGovernance({research,security,archival:badArchive}).some(x=>x.includes('ready without passed evidence')));
const evalBlocked=evaluateArchiveCandidate(archival,'dtfgenetics/Dtf420');
assert.equal(evalBlocked.ready,false);
assert.ok(evalBlocked.missing.includes('admin_permission_available'));

const ready=structuredClone(archival);
ready.candidates[0].gates=Object.fromEntries(ready.requiredGates.map(g=>[g,{status:'passed',evidence:'test:'+g}]));
assert.equal(evaluateArchiveCandidate(ready,'dtfgenetics/Dtf420').ready,true);

console.log('Project OS governance tests passed');
