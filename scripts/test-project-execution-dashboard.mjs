#!/usr/bin/env node
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';

const raw = execFileSync(process.execPath, ['scripts/project-execution-dashboard.mjs', '--json'], { encoding: 'utf8' });
const dashboard = JSON.parse(raw);

assert.ok(dashboard.totals.registeredProjects >= dashboard.totals.explicitExecutionDomains);
assert.ok(dashboard.totals.canonicalRepos >= 1);

const byId = new Map(dashboard.projects.map(project => [project.id, project]));

assert.equal(byId.get('dtf-platform')?.canonicalRepo, 'dtfgenetics/Thc');
assert.equal(byId.get('dtf-platform')?.executionContract, 'platform');

assert.equal(byId.get('plant-diagnostic')?.canonicalRepo, 'dtfgenetics/Thc-dataset');
assert.equal(byId.get('plant-diagnostic')?.executionContract, 'grow-doc');

assert.equal(byId.get('thc-academy-certification')?.canonicalRepo, 'dtfgenetics/Thc-learning-courses-');
assert.equal(byId.get('thc-academy-certification')?.executionContract, 'academy');

for (const project of dashboard.projects) {
  assert.match(project.branchPattern, /^work\/.+\/<task>\/<session-id>$/);
  assert.equal(typeof project.validationCommand, 'string');
  assert.ok(project.validationCommand.length > 0);
}

console.log('Project execution dashboard regression tests passed for ' + dashboard.totals.registeredProjects + ' registered projects.');
