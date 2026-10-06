#!/usr/bin/env node
import assert from 'node:assert/strict';
import {upsertFailure} from './record-project-os-failure.mjs';
import {upsertBlocker,resolveBlocker} from './record-project-os-blocker.mjs';

let failures={schemaVersion:1,registryId:'project-os.failure-memory-v1',entries:[]};
failures=upsertFailure(failures,{fingerprint:'timeout:dtfseeds',rootCause:'network timeout',project:'thc-rpg',successfulRepair:'retry with bounded backoff'},'2026-10-06T11:00:00Z');
failures=upsertFailure(failures,{fingerprint:'timeout:dtfseeds',rootCause:'network timeout',project:'thc-rpg',successfulRepair:'retry with bounded backoff'},'2026-10-06T12:00:00Z');
assert.equal(failures.entries.length,1);
assert.equal(failures.entries[0].occurrences,2);
assert.deepEqual(failures.entries[0].successfulRepairs,['retry with bounded backoff']);

let blockers={schemaVersion:1,registryId:'project-os.blocker-escalation-v1',allowedTypes:['human_review','permission'],entries:[]};
blockers=upsertBlocker(blockers,{blockerId:'b1',workItemId:'x',type:'human_review',humanOnly:true,requiredAction:'approve scientific review',evidence:'PR #1'},'2026-10-06T11:00:00Z');
blockers=upsertBlocker(blockers,{blockerId:'b1',workItemId:'x',type:'human_review',humanOnly:true,requiredAction:'approve scientific review',evidence:'PR #1'},'2026-10-06T11:30:00Z');
assert.equal(blockers.entries.length,1);
assert.equal(blockers.entries[0].humanOnly,true);
blockers=resolveBlocker(blockers,'b1','2026-10-06T12:00:00Z');
assert.equal(blockers.entries[0].state,'resolved');
assert.equal(blockers.entries[0].resolvedAt,'2026-10-06T12:00:00Z');
console.log('Project OS failure/blocker mutation tests passed');
