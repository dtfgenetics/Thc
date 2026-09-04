#!/usr/bin/env node

import { execFileSync } from 'node:child_process'
import { readFileSync } from 'node:fs'
import { classifyPaths } from './core.mjs'

function capture(command, args, options = {}) {
  try {
    return execFileSync(command, args, { encoding: 'utf8', maxBuffer: 16 * 1024 * 1024, ...options }).trim()
  } catch (error) {
    if (options.allowFailure) return ''
    throw error
  }
}

function run(command, args, options = {}) {
  return execFileSync(command, args, { stdio: 'inherit', ...options })
}

function unique(values) {
  return [...new Set(values)].sort()
}

const raw = process.argv.slice(2)
const positional = raw.filter((arg) => !arg.startsWith('--'))
const args = Object.fromEntries(raw.filter((arg) => arg.startsWith('--')).map((arg) => {
  const normalized = arg.replace(/^--/, '')
  const separator = normalized.indexOf('=')
  if (separator === -1) return [normalized, 'true']
  return [normalized.slice(0, separator), normalized.slice(separator + 1)]
}))

const repoRoot = capture('git', ['rev-parse', '--show-toplevel'], { allowFailure: true })
if (!repoRoot) {
  console.error('Run this command from inside the Thc repository or a linked worktree.')
  process.exit(2)
}
if (!capture('gh', ['--version'], { cwd: repoRoot, allowFailure: true })) {
  console.error('studio:integrate requires GitHub CLI.')
  process.exit(2)
}

let [target] = positional
if (!target) {
  const branch = capture('git', ['branch', '--show-current'], { cwd: repoRoot })
  target = capture('gh', ['pr', 'list', '--head', branch, '--base', 'main', '--state', 'open', '--json', 'number', '--jq', '.[0].number'], { cwd: repoRoot, allowFailure: true })
}
if (!target) {
  console.error('Usage: node scripts/studio/integrate.mjs [pr-number] [--merge] [--dispatch-production=false]')
  process.exit(2)
}

const prNumber = String(target).replace(/^#/, '')
const prText = capture('gh', [
  'pr', 'view', prNumber,
  '--json', 'number,title,url,isDraft,mergeable,headRefName,headRefOid,baseRefName'
], { cwd: repoRoot })
const pr = JSON.parse(prText)
if (pr.baseRefName !== 'main') {
  console.error(`Refusing integration into unexpected base ${pr.baseRefName}.`)
  process.exit(1)
}
if (pr.isDraft && args.merge === 'true') {
  console.error('Refusing to merge a draft PR. Mark it ready first.')
  process.exit(1)
}

run('git', ['fetch', '--quiet', 'origin', 'main'], { cwd: repoRoot })
run('git', ['fetch', '--quiet', 'origin', pr.headRefName], { cwd: repoRoot })
const mainSha = capture('git', ['rev-parse', 'origin/main'], { cwd: repoRoot })
const fetchedHead = capture('git', ['rev-parse', `origin/${pr.headRefName}`], { cwd: repoRoot })
if (fetchedHead !== pr.headRefOid) {
  console.error(`PR head moved during integration preflight. Expected ${pr.headRefOid}, fetched ${fetchedHead}. Re-run against the new exact head.`)
  process.exit(1)
}

const changedText = capture('gh', ['pr', 'diff', prNumber, '--name-only'], { cwd: repoRoot })
const changedFiles = changedText ? unique(changedText.split('\n').map((value) => value.trim()).filter(Boolean)) : []
const resourceConfig = JSON.parse(readFileSync('data/studio-resources.json', 'utf8'))
const classified = classifyPaths(resourceConfig, changedFiles)
const resources = classified.resources
const productionTargets = unique(resources.flatMap((resource) => resource.productionTargets || []))

let mergeTree = ''
try {
  mergeTree = capture('git', ['merge-tree', '--write-tree', mainSha, fetchedHead], { cwd: repoRoot })
} catch (error) {
  console.error('Current PR head does not integrate cleanly with current main. Continue development if useful, but repair this conflict before merge.')
  process.exit(error.status || 1)
}

const checksOk = (() => {
  try {
    run('gh', ['pr', 'checks', prNumber], { cwd: repoRoot })
    return true
  } catch {
    return false
  }
})()
if (!checksOk) {
  console.error('PR checks are not all passing for the current head.')
  process.exit(1)
}

const result = {
  ok: true,
  pr: pr.number,
  url: pr.url,
  title: pr.title,
  exactHead: fetchedHead,
  currentMain: mainSha,
  mergeTree,
  mergeableNow: true,
  checksPassing: true,
  changedFiles,
  resources: resources.map((resource) => resource.id),
  productionTargets,
  unmatchedFiles: classified.unmatched,
  sessionBranchWasRewritten: false,
}

if (args.merge !== 'true') {
  console.log(JSON.stringify({
    ...result,
    merged: false,
    next: `Re-run with --merge to squash-merge exactly ${fetchedHead}${productionTargets.length ? ' and dispatch cumulative production' : ''}.`,
  }, null, 2))
  process.exit(0)
}

run('gh', ['pr', 'merge', prNumber, '--squash', '--match-head-commit', fetchedHead], { cwd: repoRoot })

let remoteBranchDeleted = false
let branchCleanupNote = 'head branch is outside managed work/project/multi lanes'
if (/^(work|project|multi)\//.test(pr.headRefName)) {
  const otherOpenPrCount = Number(capture('gh', [
    'pr', 'list', '--head', pr.headRefName, '--base', 'main', '--state', 'open',
    '--json', 'number', '--jq', 'length'
  ], { cwd: repoRoot, allowFailure: true }) || '0')

  if (otherOpenPrCount > 0) {
    branchCleanupNote = `preserved remote branch because ${otherOpenPrCount} open PR(s) still use it`
  } else {
    try {
      run('git', ['push', 'origin', '--delete', pr.headRefName], { cwd: repoRoot })
      remoteBranchDeleted = true
      branchCleanupNote = 'deleted merged managed remote branch'
    } catch {
      branchCleanupNote = 'merge succeeded, but remote branch deletion failed; run studio:lifecycle --cleanup-merged'
    }
  }
}

let productionDispatch = { required: productionTargets.length > 0, attempted: false, ok: productionTargets.length === 0, workflow: null }
if (productionTargets.length > 0 && args['dispatch-production'] !== 'false') {
  productionDispatch = { required: true, attempted: true, ok: false, workflow: 'dtfseeds-production-gateway.yml' }
  try {
    run('gh', ['workflow', 'run', 'dtfseeds-production-gateway.yml', '--ref', 'main', '-f', 'mode=auto'], { cwd: repoRoot })
    productionDispatch.ok = true
  } catch (error) {
    console.error('Source merged successfully, but cumulative production dispatch failed. The merge is preserved; production handoff is incomplete.')
    console.log(JSON.stringify({
      ...result,
      merged: true,
      remoteBranchDeleted,
      branchCleanupNote,
      productionDispatch,
      liveVerified: false,
    }, null, 2))
    process.exit(error.status || 1)
  }
}

console.log(JSON.stringify({
  ...result,
  merged: true,
  remoteBranchDeleted,
  branchCleanupNote,
  productionDispatch,
  liveVerified: false,
  note: productionDispatch.required
    ? 'Source is integrated and cumulative production was dispatched. Follow the owning production run through visitor verification before calling the change live.'
    : 'Source is integrated. No classified production target was touched.',
}, null, 2))
