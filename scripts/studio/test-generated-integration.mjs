#!/usr/bin/env node

import { execFileSync } from 'node:child_process';
import { mkdtempSync, mkdirSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

function run(cwd, command, args, options = {}) {
  return execFileSync(command, args, { cwd, encoding: 'utf8', stdio: options.quiet ? 'pipe' : 'pipe' }).trim();
}

function git(cwd, ...args) {
  return run(cwd, 'git', args, { quiet: true });
}

function configure(cwd) {
  git(cwd, 'config', 'user.name', 'DTF Integration Test');
  git(cwd, 'config', 'user.email', 'integration-test@example.invalid');
}

function commitFile(cwd, path, content, message) {
  const full = join(cwd, path);
  mkdirSync(join(full, '..'), { recursive: true });
  writeFileSync(full, content);
  git(cwd, 'add', path);
  git(cwd, 'commit', '-m', message);
  return git(cwd, 'rev-parse', 'HEAD');
}

function makeRepo() {
  const root = mkdtempSync(join(tmpdir(), 'dtf-generated-integration-'));
  git(root, 'init', '-b', 'main');
  configure(root);
  commitFile(root, 'README.md', 'base\n', 'base');
  return root;
}

// Unrelated main movement must not block generated work.
{
  const repo = makeRepo();
  const base = git(repo, 'rev-parse', 'HEAD');
  git(repo, 'checkout', '-b', 'generator', base);
  const generated = commitFile(repo, 'games/alpha.txt', 'alpha release\n', 'generate alpha');

  git(repo, 'checkout', 'main');
  commitFile(repo, 'apps/beta.txt', 'beta release\n', 'advance unrelated beta');
  const movedMain = git(repo, 'rev-parse', 'HEAD');

  git(repo, 'checkout', '--detach', movedMain);
  git(repo, 'cherry-pick', generated);

  const alpha = run(repo, 'cat', ['games/alpha.txt'], { quiet: true });
  const beta = run(repo, 'cat', ['apps/beta.txt'], { quiet: true });
  if (alpha !== 'alpha release' || beta !== 'beta release') {
    throw new Error('Unrelated main movement did not preserve both projects.');
  }
}

// A genuine same-file conflict must be surfaced instead of overwriting either side.
{
  const repo = makeRepo();
  commitFile(repo, 'shared/route.txt', 'owner=base\n', 'add shared route');
  const base = git(repo, 'rev-parse', 'HEAD');

  git(repo, 'checkout', '-b', 'generator', base);
  const generated = commitFile(repo, 'shared/route.txt', 'owner=alpha\n', 'generate alpha route');

  git(repo, 'checkout', 'main');
  commitFile(repo, 'shared/route.txt', 'owner=beta\n', 'advance beta route');
  const movedMain = git(repo, 'rev-parse', 'HEAD');
  git(repo, 'checkout', '--detach', movedMain);

  let conflicted = false;
  try {
    git(repo, 'cherry-pick', generated);
  } catch {
    conflicted = true;
    git(repo, 'cherry-pick', '--abort');
  }
  if (!conflicted) {
    throw new Error('Expected a same-file integration conflict but the cherry-pick succeeded.');
  }
  const live = run(repo, 'cat', ['shared/route.txt'], { quiet: true });
  if (live !== 'owner=beta') {
    throw new Error('Conflict handling overwrote current main.');
  }
}

console.log('generated integration semantics: PASS');
