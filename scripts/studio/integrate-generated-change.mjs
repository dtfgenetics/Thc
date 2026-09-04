#!/usr/bin/env node

import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import process from 'node:process';
import { classifyPaths } from './core.mjs';

function capture(command, args, options = {}) {
  try {
    return execFileSync(command, args, {
      encoding: 'utf8',
      maxBuffer: 16 * 1024 * 1024,
      ...options,
    }).trim();
  } catch (error) {
    if (options.allowFailure) return '';
    throw error;
  }
}

function run(command, args, options = {}) {
  return execFileSync(command, args, { stdio: 'inherit', ...options });
}

function parseArgs(raw) {
  const args = {};
  const positional = [];
  for (const value of raw) {
    if (!value.startsWith('--')) {
      positional.push(value);
      continue;
    }
    const [key, ...rest] = value.replace(/^--/, '').split('=');
    args[key] = rest.join('=') || 'true';
  }
  return { args, positional };
}

function slug(value) {
  return String(value || 'generated')
    .toLowerCase()
    .replace(/[^a-z0-9._-]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60) || 'generated';
}

function unique(values) {
  return [...new Set(values.filter(Boolean))];
}

const { args, positional } = parseArgs(process.argv.slice(2));
const repoRoot = capture('git', ['rev-parse', '--show-toplevel'], { allowFailure: true });
if (!repoRoot) {
  console.error('Run this command from inside the Thc repository checkout used by the generating workflow.');
  process.exit(2);
}
if (!capture('gh', ['--version'], { cwd: repoRoot, allowFailure: true })) {
  console.error('Generated-change integration requires GitHub CLI.');
  process.exit(2);
}

const message = args.message || process.env.DTF_INTEGRATION_MESSAGE || '';
const explicitPaths = String(args.paths || process.env.DTF_INTEGRATION_PATHS || '')
  .split(',')
  .map((value) => value.trim())
  .filter(Boolean);
const paths = unique([...explicitPaths, ...positional]);
if (!message) {
  console.error('Provide --message="..." or DTF_INTEGRATION_MESSAGE.');
  process.exit(2);
}
if (paths.length === 0) {
  console.error('Provide the exact generated paths as positional arguments or --paths=a,b. Refusing to stage the whole checkout.');
  process.exit(2);
}

const statusBefore = capture('git', ['status', '--porcelain', '--', ...paths], { cwd: repoRoot, allowFailure: true });
if (!statusBefore) {
  console.log(JSON.stringify({ ok: true, changed: false, paths, note: 'No generated source change to integrate.' }, null, 2));
  process.exit(0);
}

run('git', ['add', '--', ...paths], { cwd: repoRoot });
if (!capture('git', ['diff', '--cached', '--name-only'], { cwd: repoRoot, allowFailure: true })) {
  console.log(JSON.stringify({ ok: true, changed: false, paths, note: 'No staged generated source change to integrate.' }, null, 2));
  process.exit(0);
}

const stagedText = capture('git', ['diff', '--cached', '--name-only'], { cwd: repoRoot });
const stagedFiles = stagedText.split('\n').map((value) => value.trim()).filter(Boolean);
const unexpected = stagedFiles.filter((path) => !paths.includes(path));
if (unexpected.length) {
  console.error(`Refusing integration because unrelated staged paths are present: ${unexpected.join(', ')}`);
  process.exit(1);
}

const resourceConfig = JSON.parse(readFileSync('data/studio-resources.json', 'utf8'));
const classified = classifyPaths(resourceConfig, stagedFiles);
const resourceIds = classified.resources.map((resource) => resource.id);
const productionTargets = unique(classified.resources.flatMap((resource) => resource.productionTargets || []));
const resourceLabel = slug(args.resource || resourceIds[0] || 'generated');

const originalHead = capture('git', ['rev-parse', 'HEAD'], { cwd: repoRoot });
const originalBranch = capture('git', ['branch', '--show-current'], { cwd: repoRoot, allowFailure: true });
const runId = slug(process.env.GITHUB_RUN_ID || process.env.GITHUB_RUN_NUMBER || `${Date.now()}`);
const runAttempt = slug(process.env.GITHUB_RUN_ATTEMPT || '1');

if (!capture('git', ['config', 'user.name'], { cwd: repoRoot, allowFailure: true })) {
  run('git', ['config', 'user.name', 'dtf-safe-integration-bot'], { cwd: repoRoot });
}
if (!capture('git', ['config', 'user.email'], { cwd: repoRoot, allowFailure: true })) {
  run('git', ['config', 'user.email', 'actions@users.noreply.github.com'], { cwd: repoRoot });
}

run('git', ['commit', '-m', message], { cwd: repoRoot });
const generatedCommit = capture('git', ['rev-parse', 'HEAD'], { cwd: repoRoot });
const maxAttempts = Math.max(1, Math.min(5, Number(args.attempts || 3) || 3));
let lastError = '';

for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
  run('git', ['fetch', '--quiet', 'origin', 'main'], { cwd: repoRoot });
  const currentMain = capture('git', ['rev-parse', 'origin/main'], { cwd: repoRoot });
  const branch = `automation/integrate/${resourceLabel}/${runId}-${runAttempt}-${attempt}`;

  run('git', ['checkout', '--detach', currentMain], { cwd: repoRoot });
  try {
    run('git', ['cherry-pick', generatedCommit], { cwd: repoRoot });
  } catch {
    capture('git', ['cherry-pick', '--abort'], { cwd: repoRoot, allowFailure: true });
    lastError = `Generated commit ${generatedCommit} conflicts with current main ${currentMain}.`;
    break;
  }

  run('git', ['checkout', '-B', branch], { cwd: repoRoot });
  const integrationHead = capture('git', ['rev-parse', 'HEAD'], { cwd: repoRoot });
  run('git', ['push', '--set-upstream', 'origin', branch], { cwd: repoRoot });

  const metadata = [
    '<!-- dtf-generated-integration',
    `generatedCommit: ${generatedCommit}`,
    `generatedFrom: ${originalHead}`,
    `observedMain: ${currentMain}`,
    `resourceIds: ${resourceIds.join(',') || 'unclassified'}`,
    `productionTargets: ${productionTargets.join(',') || 'none'}`,
    `paths: ${stagedFiles.join(',')}`,
    'dtf-generated-integration -->',
    '',
    'Generated source change reapplied to current main at integration time. No development-wide lock is used.'
  ].join('\n');

  const prUrl = capture('gh', [
    'pr', 'create',
    '--base', 'main',
    '--head', branch,
    '--title', message,
    '--body', metadata,
  ], { cwd: repoRoot });
  const prNumber = capture('gh', [
    'pr', 'view', branch,
    '--json', 'number',
    '--jq', '.number',
  ], { cwd: repoRoot });

  try {
    run('gh', ['pr', 'merge', prNumber, '--squash', '--match-head-commit', integrationHead], { cwd: repoRoot });
    const mergedSha = capture('gh', ['pr', 'view', prNumber, '--json', 'mergeCommit', '--jq', '.mergeCommit.oid'], { cwd: repoRoot, allowFailure: true });
    console.log(JSON.stringify({
      ok: true,
      changed: true,
      generatedCommit,
      generatedFrom: originalHead,
      originalBranch,
      integratedAgainst: currentMain,
      integrationBranch: branch,
      integrationHead,
      pr: Number(prNumber),
      prUrl,
      mergedSha: mergedSha || null,
      stagedFiles,
      resourceIds,
      productionTargets,
      globalLockUsed: false,
      mainWasMergedIntoGeneratingBranch: false,
    }, null, 2));
    process.exit(0);
  } catch {
    lastError = `PR #${prNumber} could not merge against the current main; retrying from a fresh main snapshot.`;
    capture('gh', ['pr', 'close', prNumber, '--comment', 'Superseded automatically because main advanced during generated-change integration.'], { cwd: repoRoot, allowFailure: true });
    if (attempt >= maxAttempts) break;
  }
}

const conflictBranch = `automation/conflict/${resourceLabel}/${runId}-${runAttempt}`;
run('git', ['branch', '-f', conflictBranch, generatedCommit], { cwd: repoRoot });
run('git', ['push', '--set-upstream', 'origin', `${conflictBranch}:${conflictBranch}`], { cwd: repoRoot });
const conflictMetadata = [
  '<!-- dtf-generated-integration-conflict',
  `generatedCommit: ${generatedCommit}`,
  `generatedFrom: ${originalHead}`,
  `resourceIds: ${resourceIds.join(',') || 'unclassified'}`,
  `productionTargets: ${productionTargets.join(',') || 'none'}`,
  `paths: ${stagedFiles.join(',')}`,
  'dtf-generated-integration-conflict -->',
  '',
  lastError || 'Generated source change could not be integrated automatically.',
  'The generated work is preserved on this branch; unrelated projects remain unblocked.'
].join('\n');
const conflictPr = capture('gh', [
  'pr', 'create', '--draft', '--base', 'main', '--head', conflictBranch,
  '--title', `[integration conflict] ${message}`,
  '--body', conflictMetadata,
], { cwd: repoRoot, allowFailure: true });
console.error(JSON.stringify({
  ok: false,
  changed: true,
  generatedCommit,
  conflictBranch,
  conflictPr: conflictPr || null,
  stagedFiles,
  resourceIds,
  productionTargets,
  error: lastError || 'Generated source integration failed.',
  unrelatedWorkBlocked: false,
}, null, 2));
process.exit(1);
