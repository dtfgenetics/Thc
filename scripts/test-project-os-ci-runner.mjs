#!/usr/bin/env node
import assert from 'node:assert/strict';
import {spawnSync} from 'node:child_process';
const r=spawnSync(process.execPath,['scripts/run-project-os-ci-plan.mjs','--files','content/encyclopedia/catalog.json'],{encoding:'utf8'});
assert.equal(r.status,0,r.stderr);
const plan=JSON.parse(r.stdout);
assert.ok(plan.narrowChecks.includes('verify:encyclopedia-catalog'));
assert.deepEqual(plan.broadChecks,[]);
const full=spawnSync(process.execPath,['scripts/run-project-os-ci-plan.mjs','--files','package.json'],{encoding:'utf8'});
assert.equal(full.status,0,full.stderr);
const fullPlan=JSON.parse(full.stdout);
assert.equal(fullPlan.fullValidation,true);
assert.ok(fullPlan.broadChecks.includes('verify:project-os'));
assert.ok(!fullPlan.narrowChecks.includes('verify:project-os'));
console.log('Project OS CI plan runner tests passed');
