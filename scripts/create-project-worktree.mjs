#!/usr/bin/env node

import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync } from 'node:fs';
import { basename, dirname, join, resolve } from 'node:path';

function run(command, args, options = {}) {
  return execFileSync(command, args, { stdio: 'inherit', ...options });
}

function capture(command, args) {
  try {
    return execFileSync(command, args, { encoding: 'utf8' }).trim();
  } catch {
    return '';
  }
}

const positional = process.argv.slice(2).filter((arg) => !arg.startsWith('--'));
const options = Object.fromEntries(process.argv.slice(2).filter((arg) => arg.startsWith('--')).map((arg) => {
  const [key, ...rest] = arg.replace(/^--/, '').split('=');
  return [key, rest.join('=') || 'true'];
}));

const [projectRaw, taskRaw] = positional;
if (!projectRaw || !taskRaw) {
  console.error('Usage: node scripts/create-project-worktree.mjs <project-id> <task> [--base=main] [--multi] [--root=/path]');
  process.exit(2);
}

function slug(value) {
  return String(value)
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9-]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .replace(/-{2,}/g, '-');
}

const project = slug(projectRaw);
const task = slug(taskRaw);
const base = slug(options.base || 'main');
const isMulti = options.multi === 'true';

if (!project || !task || !base) {
  console.error('Project, task, and base must contain letters/numbers after normalization.');
  process.exit(2);
}

const repoRoot = capture('git', ['rev-parse', '--show-toplevel']);
if (!repoRoot) {
  console.error('Run this command from inside the Thc Git repository.');
  process.exit(2);
}

const repoName = basename(repoRoot);
const branch = isMulti ? `multi/${task}` : `project/${project}/${task}`;
const worktreeRoot = options.root
  ? resolve(options.root)
  : join(dirname(repoRoot), `${repoName}-worktrees`);
const worktreePath = join(worktreeRoot, `${isMulti ? 'multi' : project}-${task}`);

if (existsSync(worktreePath)) {
  console.error(`Worktree path already exists: ${worktreePath}`);
  process.exit(1);
}

mkdirSync(worktreeRoot, { recursive: true });

console.log(`Fetching origin/${base}...`);
run('git', ['fetch', 'origin', base], { cwd: repoRoot });

const localBranch = capture('git', ['show-ref', '--verify', `refs/heads/${branch}`]);
const remoteBranch = capture('git', ['show-ref', '--verify', `refs/remotes/origin/${branch}`]);

if (localBranch) {
  run('git', ['worktree', 'add', worktreePath, branch], { cwd: repoRoot });
} else if (remoteBranch) {
  run('git', ['branch', '--track', branch, `origin/${branch}`], { cwd: repoRoot });
  run('git', ['worktree', 'add', worktreePath, branch], { cwd: repoRoot });
} else {
  run('git', ['worktree', 'add', '-b', branch, worktreePath, `origin/${base}`], { cwd: repoRoot });
}

console.log('');
console.log('Parallel project workspace created.');
console.log(`Branch:   ${branch}`);
console.log(`Worktree: ${worktreePath}`);
console.log('');
console.log('Each project can now be edited, tested, committed, and pushed without changing the checkout used by other projects.');
console.log(`Next: cd ${JSON.stringify(worktreePath)}`);
