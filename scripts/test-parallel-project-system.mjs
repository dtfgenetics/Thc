#!/usr/bin/env node

import { execFileSync, spawnSync } from 'node:child_process';
import { mkdtempSync, mkdirSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';

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

mkdirSync(join(repo, 'content/encyclopedia'), { recursive: true });
writeFileSync(join(repo, 'content/encyclopedia/example.json'), '{}\n');
git(repo, ['add', '.']);
git(repo, ['commit', '-m', 'education change']);
const headSha = git(repo, ['rev-parse', 'HEAD']);

const planned = execFileSync(process.execPath, [
  planner,
  '--mode=auto',
  `--base=${git(repo, ['rev-parse', 'HEAD^'])}`,
  `--head=${headSha}`,
  `--config=${releaseConfig}`
], {
  cwd: repo,
  encoding: 'utf8'
});

const plan = JSON.parse(planned);
if (plan.checkpoint?.sha !== checkpointSha) {
  console.error('FAIL: planner did not use the production checkpoint tag.');
  console.error(planned);
  process.exit(1);
}
if (plan.lanes.publicSuite !== true || plan.lanes.education !== true) {
  console.error('FAIL: planner did not accumulate both project changes since the checkpoint.');
  console.error(planned);
  process.exit(1);
}
if (!plan.changedFiles.includes('games/high-iq/app.js') || !plan.changedFiles.includes('content/encyclopedia/example.json')) {
  console.error('FAIL: planner lost a changed path between the checkpoint and current head.');
  console.error(planned);
  process.exit(1);
}

console.log('PASS: checkpoint planner accumulates rapid parallel changes');
console.log('Parallel project system self-test passed.');
