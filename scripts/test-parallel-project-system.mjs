#!/usr/bin/env node

import { execFileSync, spawnSync } from 'node:child_process';
import { mkdtempSync, mkdirSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';

const root = resolve('.');
const laneCheck = join(root, 'scripts/project-lane-check.mjs');
const planner = join(root, 'scripts/plan-dtfseeds-release.mjs');
const releaseConfig = join(root, 'site/deployment/release-lanes.json');

function expectStatus(label, expected, args) {
  const result = spawnSync(process.execPath, [laneCheck, ...args], {
    cwd: root,
    encoding: 'utf8'
  });
  if (result.status !== expected) {
    console.error(`FAIL: ${label}`);
    console.error(result.stdout);
    console.error(result.stderr);
    process.exit(1);
  }
  console.log(`PASS: ${label}`);
}

expectStatus('project lane accepts owned game files', 0, [
  '--branch=project/high-iq/question-ui',
  '--files=games/high-iq/app.js,site/public-route-patch/games/high-iq/index.html'
]);

expectStatus('project lane rejects unrelated game files', 1, [
  '--branch=project/high-iq/question-ui',
  '--files=games/high-life/index.html'
]);

expectStatus('multi lane allows intentional cross-project work', 0, [
  '--branch=multi/game-hub-release',
  '--files=games/high-iq/app.js,games/high-life/index.html,content/encyclopedia/example.json'
]);

expectStatus('platform lane allows repository integration work', 0, [
  '--branch=project/platform/release-system',
  '--files=.github/workflows/example.yml,games/high-life/index.html,site/wordpress/example.json'
]);

function git(cwd, args) {
  return execFileSync('git', args, { cwd, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }).trim();
}

function runPlanner(repo, args) {
  return JSON.parse(execFileSync(process.execPath, [
    planner,
    ...args,
    `--config=${releaseConfig}`
  ], {
    cwd: repo,
    encoding: 'utf8'
  }));
}

const repo = mkdtempSync(join(tmpdir(), 'dtf-release-plan-'));
git(repo, ['init', '-b', 'main']);
git(repo, ['config', 'user.email', 'parallel-test@dtf.local']);
git(repo, ['config', 'user.name', 'DTF Parallel Test']);

writeFileSync(join(repo, 'README.md'), 'base\n');
git(repo, ['add', '.']);
git(repo, ['commit', '-m', 'base']);
git(repo, ['tag', 'dtfseeds-production']);
const checkpointSha = git(repo, ['rev-parse', 'HEAD']);

mkdirSync(join(repo, 'games/high-iq'), { recursive: true });
writeFileSync(join(repo, 'games/high-iq/app.js'), 'console.log("high iq");\n');
git(repo, ['add', '.']);
git(repo, ['commit', '-m', 'high iq change']);
const highIqSha = git(repo, ['rev-parse', 'HEAD']);

mkdirSync(join(repo, 'content/encyclopedia'), { recursive: true });
writeFileSync(join(repo, 'content/encyclopedia/example.json'), '{}\n');
git(repo, ['add', '.']);
git(repo, ['commit', '-m', 'education change']);
const headSha = git(repo, ['rev-parse', 'HEAD']);

// Controlled comparisons and CI can supply an exact base. That explicit base
// must win so a one-resource test is not polluted by older undeployed history.
const exactPlan = runPlanner(repo, [
  '--mode=auto',
  `--base=${highIqSha}`,
  `--head=${headSha}`
]);
if (exactPlan.checkpoint !== null || exactPlan.base !== highIqSha) {
  console.error('FAIL: explicit planner base was not preserved.');
  console.error(JSON.stringify(exactPlan, null, 2));
  process.exit(1);
}
if (exactPlan.lanes.publicSuite !== false || exactPlan.lanes.education !== true) {
  console.error('FAIL: explicit planner base did not isolate the education-only delta.');
  console.error(JSON.stringify(exactPlan, null, 2));
  process.exit(1);
}
if (exactPlan.changedFiles.length !== 1 || exactPlan.changedFiles[0] !== 'content/encyclopedia/example.json') {
  console.error('FAIL: explicit planner base included unrelated history.');
  console.error(JSON.stringify(exactPlan, null, 2));
  process.exit(1);
}
console.log('PASS: explicit release base isolates controlled comparisons');

// Real automatic production omits an explicit base. It must use the last
// successful production checkpoint so rapid independent merges accumulate and
// no undeployed project disappears when main advances.
const cumulativePlan = runPlanner(repo, [
  '--mode=auto',
  `--head=${headSha}`
]);
if (cumulativePlan.checkpoint?.sha !== checkpointSha || cumulativePlan.base !== checkpointSha) {
  console.error('FAIL: cumulative planner did not use the production checkpoint tag.');
  console.error(JSON.stringify(cumulativePlan, null, 2));
  process.exit(1);
}
if (cumulativePlan.lanes.publicSuite !== true || cumulativePlan.lanes.education !== true) {
  console.error('FAIL: cumulative planner did not include both project changes since the checkpoint.');
  console.error(JSON.stringify(cumulativePlan, null, 2));
  process.exit(1);
}
if (!cumulativePlan.changedFiles.includes('games/high-iq/app.js') || !cumulativePlan.changedFiles.includes('content/encyclopedia/example.json')) {
  console.error('FAIL: cumulative planner lost a changed path between the checkpoint and current head.');
  console.error(JSON.stringify(cumulativePlan, null, 2));
  process.exit(1);
}
console.log('PASS: checkpoint planner accumulates rapid parallel changes');

// workflow_dispatch can supply an explicitly empty --base=. Empty values must
// remain empty instead of being coerced to the boolean-style string "true".
// Production should therefore still resolve the cumulative checkpoint.
const emptyBasePlan = runPlanner(repo, [
  '--mode=auto',
  '--base=',
  `--fallback-base=${highIqSha}`,
  `--head=${headSha}`
]);
if (emptyBasePlan.requestedBase !== null || emptyBasePlan.checkpoint?.sha !== checkpointSha || emptyBasePlan.base !== checkpointSha) {
  console.error('FAIL: empty planner base was not preserved as empty.');
  console.error(JSON.stringify(emptyBasePlan, null, 2));
  process.exit(1);
}
if (emptyBasePlan.changedFiles.includes('true')) {
  console.error('FAIL: empty planner base was coerced to the string true.');
  console.error(JSON.stringify(emptyBasePlan, null, 2));
  process.exit(1);
}
console.log('PASS: empty release base remains empty and resolves cumulative checkpoint');
console.log('Parallel project system self-test passed.');
