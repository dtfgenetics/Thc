#!/usr/bin/env node

import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';

const config = JSON.parse(readFileSync('data/project-work-lanes.json', 'utf8'));
const argv = Object.fromEntries(process.argv.slice(2).map((arg) => {
  const clean = arg.replace(/^--/, '');
  const [key, ...rest] = clean.split('=');
  return [key, rest.join('=') || 'true'];
}));

function git(args, fallback = '') {
  try {
    return execFileSync('git', args, { encoding: 'utf8' }).trim();
  } catch {
    return fallback;
  }
}

function normalizeBranch(value) {
  return String(value || '')
    .replace(/^refs\/heads\//, '')
    .replace(/^refs\/remotes\/origin\//, '');
}

const branch = normalizeBranch(
  argv.branch ||
  process.env.PROJECT_BRANCH ||
  process.env.GITHUB_HEAD_REF ||
  process.env.GITHUB_REF_NAME ||
  git(['branch', '--show-current'])
);

function getChangedFiles() {
  if (argv.files) return argv.files.split(',').map((v) => v.trim()).filter(Boolean);

  const explicitBase = argv.base || process.env.PROJECT_BASE || process.env.GITHUB_BASE_SHA;
  const head = argv.head || process.env.PROJECT_HEAD || 'HEAD';
  if (explicitBase) {
    const direct = git(['diff', '--name-only', `${explicitBase}...${head}`]);
    if (direct) return direct.split('\n').filter(Boolean);
  }

  const mergeBase = git(['merge-base', 'origin/main', head]);
  if (mergeBase) {
    const diff = git(['diff', '--name-only', `${mergeBase}...${head}`]);
    if (diff) return diff.split('\n').filter(Boolean);
  }

  const lastCommit = git(['show', '--pretty=', '--name-only', head]);
  return lastCommit ? lastCommit.split('\n').filter(Boolean) : [];
}

function startsWithAny(path, prefixes = []) {
  return prefixes.some((prefix) => path === prefix || path.startsWith(prefix));
}

function allowedByGenericProjectPath(projectId, path) {
  return config.genericProjectPrefixes.some((template) => {
    const prefix = template.replaceAll('{id}', projectId);
    return path === prefix || path.startsWith(prefix);
  });
}

function allowedDynamicProjectTooling(projectId, path) {
  if (path.startsWith('.github/workflows/') && path.includes(projectId)) return true;
  if (path.startsWith('scripts/') && path.includes(projectId)) return true;
  if (path.startsWith('tests/') && path.includes(projectId)) return true;
  return false;
}

const files = getChangedFiles();
const projectPrefix = config.branching.projectPrefix;
const multiPrefix = config.branching.multiPrefix;

let mode = 'compatibility';
let projectId = null;
let unrestricted = false;

if (branch.startsWith(multiPrefix)) {
  mode = 'multi';
  unrestricted = true;
} else if (branch.startsWith(projectPrefix)) {
  const remainder = branch.slice(projectPrefix.length);
  projectId = remainder.split('/')[0] || null;
  mode = 'project';
  unrestricted = projectId === config.branching.platformProjectId || Boolean(config.lanes[projectId]?.unrestricted);
}

if (mode === 'compatibility') {
  console.log(JSON.stringify({
    ok: true,
    enforced: false,
    branch,
    mode,
    changedFiles: files,
    message: 'Legacy/compatibility branch: project lane isolation is advisory. Use project/<id>/<task> for isolated work or multi/<task> for intentional cross-project work.'
  }, null, 2));
  process.exit(0);
}

if (unrestricted) {
  console.log(JSON.stringify({
    ok: true,
    enforced: true,
    branch,
    mode,
    projectId,
    unrestricted: true,
    changedFiles: files,
    message: 'Cross-project work is explicitly allowed on this branch.'
  }, null, 2));
  process.exit(0);
}

if (!projectId) {
  console.error('Project branch is missing a project id. Expected project/<id>/<task>.');
  process.exit(2);
}

const lane = config.lanes[projectId] || { prefixes: [] };
const violations = [];
const shared = [];
const owned = [];

for (const path of files) {
  if (startsWithAny(path, config.sharedPrefixes)) {
    shared.push(path);
    continue;
  }
  if (startsWithAny(path, lane.prefixes) || allowedByGenericProjectPath(projectId, path) || allowedDynamicProjectTooling(projectId, path)) {
    owned.push(path);
    continue;
  }
  violations.push(path);
}

const result = {
  ok: violations.length === 0,
  enforced: true,
  branch,
  mode,
  projectId,
  ownedFiles: owned,
  sharedFiles: shared,
  violations,
  escapeHatches: [
    `Use ${multiPrefix}<task> for an intentional multi-project change.`,
    `Use ${projectPrefix}${config.branching.platformProjectId}/<task> for repository/platform integration work.`
  ]
};

console.log(JSON.stringify(result, null, 2));
if (violations.length) {
  console.error(`Project lane violation: ${projectId} branch touched ${violations.length} unrelated path(s).`);
  process.exit(1);
}
