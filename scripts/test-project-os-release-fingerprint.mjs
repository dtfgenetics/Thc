#!/usr/bin/env node
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {spawnSync} from 'node:child_process';
import {verifyFingerprint,reconcileQueue} from './reconcile-project-os-deployment.mjs';

const contract=JSON.parse(fs.readFileSync('data/project-os/deployment-fingerprint-contract.json','utf8'));
const tmp=fs.mkdtempSync(path.join(os.tmpdir(),'project-os-fp-'));
const out=path.join(tmp,'fp.json');
const env={...process.env,PROJECT_OS_SOURCE_REVISION:'abc123',PROJECT_OS_BUILD_ID:'42',PROJECT_OS_GENERATED_AT:'2026-10-06T10:00:00Z',PROJECT_OS_FINGERPRINT_OUT:out};
const built=spawnSync(process.execPath,['scripts/build-project-os-release-fingerprint.mjs'],{encoding:'utf8',env});
assert.equal(built.status,0,built.stderr);
const expected=JSON.parse(fs.readFileSync(out,'utf8'));
assert.deepEqual(verifyFingerprint(contract,expected,structuredClone(expected)),[]);
const wrong={...expected,sourceRevision:'wrong'};
assert.ok(verifyFingerprint(contract,expected,wrong).some(x=>x.includes('sourceRevision mismatch')));
const queue={items:[{workItemId:'x',state:'done',deployment:{state:'verified'},blocker:null}]};
const failed=reconcileQueue(queue,{workItemId:'x',expected,observed:wrong,verifiedAt:'2026-10-06T10:01:00Z'});
assert.equal(failed.queue.items[0].state,'failed');
assert.equal(failed.queue.items[0].deployment.state,'failed');
assert.equal(failed.queue.items[0].blocker.type,'live_drift');
const ok=reconcileQueue(queue,{workItemId:'x',expected,observed:expected,verifiedAt:'2026-10-06T10:01:00Z'});
assert.equal(ok.queue.items[0].deployment.state,'verified');
assert.equal(ok.errors.length,0);
const queuePath=path.join(tmp,'queue.json');
const observedPath=path.join(tmp,'observed.json');
fs.writeFileSync(queuePath,JSON.stringify(queue));
fs.writeFileSync(observedPath,JSON.stringify(wrong));
const cli=spawnSync(process.execPath,['scripts/reconcile-project-os-deployment.mjs',out,observedPath,'--queue',queuePath,'--work-item','x','--write'],{encoding:'utf8'});
assert.notEqual(cli.status,0);
const persisted=JSON.parse(fs.readFileSync(queuePath,'utf8'));
assert.equal(persisted.items[0].state,'failed');
assert.equal(persisted.items[0].blocker.type,'live_drift');

fs.rmSync(tmp,{recursive:true,force:true});
console.log('Project OS release fingerprint tests passed');
