#!/usr/bin/env node

import { execFileSync } from 'node:child_process'
import { existsSync, readFileSync } from 'node:fs'
import path from 'node:path'

function capture(command, args, options = {}) {
  try {
    return execFileSync(command, args, {
      encoding: 'utf8',
      maxBuffer: 32 * 1024 * 1024,
      stdio: ['ignore', 'pipe', 'pipe'],
      ...options,
    }).trim()
  } catch (error) {
    if (options.allowFailure) return ''
    throw error
  }
}

function succeeds(command, args, options = {}) {
  try {
    execFileSync(command, args, { stdio: 'ignore', ...options })
    return true
  } catch {
    return false
  }
}

const apply = process.argv.slice(2).includes('--apply')
const repoRoot = capture('git', ['rev-parse', '--show-toplevel'], { allowFailure: true })
if (!repoRoot) {
  console.error('Run this command from inside the Thc repository or a linked worktree.')
  process.exit(2)
}
if (!capture('gh', ['--version'], { cwd: repoRoot, allowFailure: true })) {
  console.error('retire-reviewed requires GitHub CLI so open pull requests can block deletion.')
  process.exit(2)
}

const registryPath = path.join(repoRoot, 'data', 'branch-retirements.json')
if (!existsSync(registryPath)) {
  console.error('Missing data/branch-retirements.json reviewed-retirement registry.')
  process.exit(2)
}

const registry = JSON.parse(readFileSync(registryPath, 'utf8'))
if (registry?.schemaVersion !== 1 || !Array.isArray(registry?.retirements)) {
  console.error('branch-retirements.json must use schemaVersion 1 with a retirements array.')
  process.exit(2)
}

capture('git', [
  'fetch', '--quiet', '--prune', 'origin',
  '+refs/heads/*:refs/remotes/origin/*',
], { cwd: repoRoot })

const main = capture('git', ['rev-parse', '--verify', 'origin/main'], { cwd: repoRoot })
const openPrText = capture('gh', [
  'pr', 'list', '--state', 'open', '--limit', '2000', '--json', 'number,headRefName,url,title',
], { cwd: repoRoot })
const openPrs = openPrText ? JSON.parse(openPrText) : []
const openBranches = new Map(openPrs.map((pr) => [pr.headRefName, pr]))

const decisions = []
for (const entry of registry.retirements) {
  const branch = String(entry?.branch || '')
  const expectedHead = String(entry?.headSha || '')
  const supersededBy = String(entry?.supersededBy || '')
  const approved = entry?.status === 'approved'
  const currentHead = branch && branch !== 'main'
    ? capture('git', ['rev-parse', '--verify', `origin/${branch}`], { cwd: repoRoot, allowFailure: true })
    : ''
  const branchExists = Boolean(currentHead)
  const headMatches = branchExists && /^[0-9a-f]{40}$/.test(expectedHead) && currentHead === expectedHead
  const openPr = openBranches.get(branch) || null
  const noOpenPr = !openPr
  const supersedingCommitValid = /^[0-9a-f]{40}$/.test(supersededBy)
  const supersedingCommitOnMain = supersedingCommitValid && succeeds(
    'git', ['merge-base', '--is-ancestor', supersededBy, main], { cwd: repoRoot },
  )
  const safeToRetire = Boolean(
    approved && branch && branch !== 'main' && branchExists && headMatches && noOpenPr && supersedingCommitOnMain
  )
  const alreadyRetired = approved && branch && branch !== 'main' && !branchExists

  decisions.push({
    ...entry,
    branch,
    currentHead: currentHead || null,
    branchExists,
    headMatches,
    openPr,
    noOpenPr,
    supersedingCommitOnMain,
    safeToRetire,
    alreadyRetired,
  })
}

const candidates = decisions.filter((item) => item.safeToRetire)
const blocked = decisions.filter((item) => !item.safeToRetire && !item.alreadyRetired)
const alreadyRetired = decisions.filter((item) => item.alreadyRetired)
const deleted = []
const deleteFailures = []

if (apply) {
  for (const item of candidates) {
    try {
      execFileSync('git', ['push', 'origin', '--delete', item.branch], {
        cwd: repoRoot,
        stdio: ['ignore', 'pipe', 'pipe'],
      })
      deleted.push(item.branch)
    } catch (error) {
      deleteFailures.push({
        branch: item.branch,
        error: String(error.stderr || error.message || 'remote delete failed').trim(),
      })
    }
  }
}

console.log(JSON.stringify({
  ok: deleteFailures.length === 0,
  observedMain: main,
  apply,
  reviewedCount: decisions.length,
  candidateCount: candidates.length,
  blockedCount: blocked.length,
  alreadyRetiredCount: alreadyRetired.length,
  deletedCount: deleted.length,
  deleted,
  deleteFailures,
  candidates,
  blocked,
  alreadyRetired,
  policy: {
    exactHeadRequired: true,
    openPullRequest: 'block deletion',
    supersedingCommit: 'must be an ancestor of current main',
    missingBranch: 'treat as already retired; never recreate it',
    changedBranchHead: 'block deletion until reviewed again',
  },
}, null, 2))

if (deleteFailures.length) process.exit(1)
