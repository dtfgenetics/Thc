#!/usr/bin/env node
import assert from 'node:assert/strict';
import {spawnSync} from 'node:child_process';
function run(files,...extra){
 const r=spawnSync(process.execPath,['scripts/plan-project-os-ci.mjs','--files',files,...extra],{encoding:'utf8'});
 assert.equal(r.status,0,r.stderr);
 return JSON.parse(r.stdout);
}
const game=run('games/high-life/src/engine.mjs');
assert.ok(game.checks.includes('games:affected:check'));
assert.ok(game.affectedDomains.some(x=>x.id==='games'));
const enc=run('content/encyclopedia/catalog.json');
assert.ok(enc.checks.includes('verify:encyclopedia-catalog'));
const projectOs=run('data/project-os/ci-impact-rules.json');
assert.ok(projectOs.checks.includes('verify:project-os-ci-planner'));

const cross=run('data/project-os/work-queue.json,site/deployment/public-apps.json,apps/growlens-web/src/main.ts');
assert.equal(cross.fullValidation,true);
assert.ok(cross.checks.includes('verify:project-os'));
const pkg=run('package.json');
assert.equal(pkg.fullValidation,true);
assert.ok(pkg.checks.includes('verify:project-os'));
assert.ok(!pkg.narrowChecks.includes('verify:project-os'));
assert.ok(pkg.broadChecks.includes('verify:project-os'));
console.log('Project OS CI planner tests passed');
