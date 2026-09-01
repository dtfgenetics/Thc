#!/usr/bin/env node

import { execFileSync } from 'node:child_process';

const args = Object.fromEntries(process.argv.slice(2).filter((arg) => arg.startsWith('--')).map((arg) => {
  const [key, ...rest] = arg.replace(/^--/, '').split('=');
  return [key, rest.join('=') || 'true'];
}));

function capture(command, commandArgs, options = {}) {
  try {
    return execFileSync(command, commandArgs, { encoding: 'utf8', ...options }).trim();
  } catch (error) {
    if (options.allowFailure) return '';
    throw error;
  }
}

function succeeds(command, commandArgs, options = {}) {
  try {
    execFileSync(command, commandArgs, { stdio: 'ignore', ...options });
    return true;
  } catch {
    return false;
  }
}

function run(command, commandArgs, options = {}) {
  execFileSync(command, commandArgs, { stdio: 'inherit', ...options });
}

const repoRoot = capture('git', ['rev-parse', '--show-toplevel'], { allowFailure: true });
if (!repoRoot) {
  console.error('Run this command from inside the Thc repository or one of its worktrees.');
  process.exit(2);
}

const branch = capture('git', ['branch', '--show-current'], { cwd: repoRoot });
if (!branch.startsWith('project/') && !branch.startsWith('multi/')) {
  console.error('Release from an isolated project/<id>/<task> branch or an intentional multi/<task> branch.');
  process.exit(2);
}

const dirty = capture('git', ['status', '--porcelain'], { cwd: repoRoot });
if (dirty) {
  console.error('Commit or stash working-tree changes before releasing. This prevents a partial release.');
  process.exit(1);
}

console.log(`Preparing ${branch} for release...`);
run('git', ['fetch', 'origin', 'main'], { cwd: repoRoot });

if (args['no-sync'] !== 'true' && !succeeds('git', ['merge-base', '--is-ancestor', 'origin/main', 'HEAD'], { cwd: repoRoot })) {
  console.log('Syncing the latest main into this project branch...');
  run('git', ['merge', '--no-edit', 'origin/main'], { cwd: repoRoot });
}

run(process.execPath, ['scripts/project-lane-check.mjs', `--branch=${branch}`], { cwd: repoRoot });

console.log('Pushing isolated project branch...');
run('git', ['push', '--set-upstream', 'origin', branch], { cwd: repoRoot });

const ghAvailable = capture('gh', ['--version'], { cwd: repoRoot, allowFailure: true });
if (!ghAvailable) {
  console.log('Branch pushed successfully. GitHub CLI is not installed, so create/merge the PR in GitHub.');
  process.exit(0);
}

let prUrl = capture('gh', [
  'pr', 'list',
  '--head', branch,
  '--base', 'main',
  '--state', 'open',
  '--json', 'url',
  '--jq', '.[0].url'
], { cwd: repoRoot, allowFailure: true });

if (!prUrl) {
  const createArgs = ['pr', 'create', '--base', 'main', '--head', branch, '--fill'];
  if (args.title) createArgs.push('--title', args.title);
  prUrl = capture('gh', createArgs, { cwd: repoRoot });
}

console.log(`Pull request: ${prUrl}`);

if (args.merge !== 'true') {
  console.log('Project is pushed and ready. Run with --merge to wait for checks and merge to main.');
  process.exit(0);
}

console.log('Waiting for pull-request checks...');
run('gh', ['pr', 'checks', prUrl, '--watch'], { cwd: repoRoot });

console.log('Checks passed. Merging to main...');
run('gh', ['pr', 'merge', prUrl, '--squash'], { cwd: repoRoot });

console.log('Merged. The DTFSeeds production gateway will automatically route and publish the affected production lane(s).');
