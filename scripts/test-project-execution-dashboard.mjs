#!/usr/bin/env node
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';

const raw = execFileSync(process.execPath, ['scripts/project-execution-dashboard.mjs', '--json'], { encoding: 'utf8' });
const dashboard = JSON.parse(raw);

assert.ok(dashboard.totals.registeredProjects >= dashboard.totals.explicitExecutionDomains);
assert.ok(dashboard.totals.canonicalRepos >= 1);
assert.ok(dashboard.totals.registeredRepositories >= dashboard.totals.canonicalRepos);
assert.ok(Array.isArray(dashboard.completionQueues.archiveReadyRepos));
assert.ok(Array.isArray(dashboard.completionQueues.migrationRepos));
assert.ok(Array.isArray(dashboard.completionQueues.preproductionProjects));
assert.ok(Array.isArray(dashboard.completionQueues.prototypeProjects));

const byId = new Map(dashboard.projects.map(project => [project.id, project]));

assert.equal(byId.get('dtf-platform')?.canonicalRepo, 'dtfgenetics/Thc');
assert.equal(byId.get('dtf-platform')?.executionContract, 'platform');
assert.equal(byId.get('dtf-platform')?.agentExecutionMode, 'local');
assert.equal(byId.get('dtf-platform')?.repositoryStatus, 'canonical');

assert.equal(byId.get('plant-diagnostic')?.canonicalRepo, 'dtfgenetics/Thc-dataset');
assert.equal(byId.get('plant-diagnostic')?.executionContract, 'grow-doc');
assert.equal(byId.get('plant-diagnostic')?.agentExecutionMode, 'external-executor');
assert.equal(byId.get('plant-diagnostic')?.agentContractPath, 'dtf-agent-contract.json');
assert.equal(byId.get('plant-diagnostic')?.repositoryStatus, 'canonical');

assert.equal(byId.get('thc-academy-certification')?.canonicalRepo, 'dtfgenetics/Thc-learning-courses-');
assert.equal(byId.get('thc-academy-certification')?.executionContract, 'academy');
assert.equal(byId.get('thc-academy-certification')?.agentExecutionMode, 'external-executor');

assert.equal(byId.get('discord-music-bot-duplicate')?.agentExecutionMode, 'archive-only');
assert.equal(byId.get('all-in-one-thc-grow')?.agentExecutionMode, 'archive-only');
assert.equal(byId.get('monetization-os')?.agentExecutionMode, 'non-github');

assert.ok(dashboard.completionQueues.archiveReadyRepos.includes('dtfgenetics/code'));
assert.ok(dashboard.completionQueues.archiveReadyRepos.includes('dtfgenetics/all-in-one-thc-grow-'));
assert.ok(dashboard.completionQueues.migrationRepos.includes('dtfgenetics/Dtf420'));
assert.ok(dashboard.completionQueues.migrationRepos.includes('dtfgenetics/dtf-thc-hub'));

for (const project of dashboard.projects) {
  assert.match(project.branchPattern, /^work\/.+\/<task>\/<session-id>$/);
  assert.equal(typeof project.validationCommand, 'string');
  assert.ok(project.validationCommand.length > 0);
  assert.notEqual(project.agentExecutionMode, 'undeclared');
  assert.notEqual(project.repositoryStatus, 'unregistered');
  assert.equal(typeof project.nextActionHint, 'string');
  assert.ok(project.nextActionHint.length > 0);
}

console.log('Project execution dashboard regression tests passed for ' + dashboard.totals.registeredProjects + ' registered projects and ' + dashboard.totals.registeredRepositories + ' registered repositories.');
