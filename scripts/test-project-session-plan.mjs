#!/usr/bin/env node
import assert from 'node:assert/strict';
import { execFileSync, spawnSync } from 'node:child_process';

function plan(id) {
  return JSON.parse(execFileSync(process.execPath, ['scripts/project-session-plan.mjs', id], { encoding: 'utf8' }));
}

const atlas = plan('plant-atlas');
assert.equal(atlas.ok, true);
assert.equal(atlas.canonicalRepo, 'dtfgenetics/Tools');
assert.equal(atlas.agentExecutionMode, 'external-executor');
assert.equal(atlas.agentContractPath, 'dtf-agent-contract.json');
assert.equal(atlas.branchPattern, 'work/plant-atlas/<task>/<session-id>');
assert.match(atlas.focusedValidationCommand, /validate-plant-atlas-v4/);

const growDoc = plan('grow-doc');
assert.equal(growDoc.canonicalRepo, 'dtfgenetics/Thc-dataset');
assert.equal(growDoc.integration.repo, 'dtfgenetics/Thc');

const academy = plan('academy');
assert.equal(academy.canonicalRepo, 'dtfgenetics/Thc-learning-courses-');

const encyclopedia = plan('encyclopedia');
assert.equal(encyclopedia.canonicalRepo, 'dtfgenetics/thc-grow-hub');

const highIq = plan('high-iq');
assert.equal(highIq.ok, true);
assert.equal(highIq.project, 'high-iq');
assert.equal(highIq.canonicalRepo, 'dtfgenetics/Thc');
assert.equal(highIq.agentExecutionMode, 'local');
assert.equal(highIq.agentContractPath, null);
assert.equal(highIq.branchPattern, 'work/high-iq/<task>/<session-id>');

const weedopolis = plan('weedopolis');
assert.equal(weedopolis.canonicalRepo, 'dtfgenetics/Weedopolis-strain-Edition');
assert.equal(weedopolis.agentExecutionMode, 'external-executor');

const migration = plan('dtf420-migration');
assert.equal(migration.canonicalRepo, 'dtfgenetics/Dtf420');
assert.equal(migration.agentExecutionMode, 'migration-only');

const toolsAlias = plan('cultivation-tools');
assert.equal(toolsAlias.project, 'tools');
assert.equal(toolsAlias.canonicalRepo, 'dtfgenetics/Tools');

const unknown = spawnSync(process.execPath, ['scripts/project-session-plan.mjs', 'definitely-not-a-project'], { encoding: 'utf8' });
assert.notEqual(unknown.status, 0);
assert.match(unknown.stderr, /Unknown project/);

console.log('Project session planner regression tests passed.');
