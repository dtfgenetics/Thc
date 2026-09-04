#!/usr/bin/env node

import { execFileSync } from 'node:child_process'
import { classifyBranchLifecycle, parseWorkBranch } from './core.mjs'

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

const flags = new Set(process.argv.slice(2).filter((arg) => arg.startsWith('--')))
const cleanupMerged = flags.has('--cleanup-merged')

const repoRoot = capture('git', ['rev-parse', '--show-toplevel'], { allowFailure: true })
if (!repoRoot) {
  console.error('Run this command from inside the Thc repository or a linked worktree.')
  process.exit(2)
}
if (!capture('gh', ['--version'], { cwd: repoRoot, allowFailure: true })) {
  console.error('studio:lifecycle requires GitHub CLI so branch state can be reconciled with pull requests.')
  process.exit(2)
}

capture('git', [
  'fetch', '--quiet', '--prune', 'origin',
  '+refs/heads/*:refs/remotes/origin/*',
], { cwd: repoRoot })

const main = capture('git', ['rev-parse', '--verify', 'origin/main'], { cwd: repoRoot })
const branchText = capture('git', [
  'for-each-ref', '--format=%(refname:strip=3)', 'refs/remotes/origin',
], { cwd: repoRoot })
const branches = branchText
  .split('\n')
  .map((value) => value.trim())
  .filter(Boolean)
  .filter((branch) => branch !== 'HEAD' && branch !== 'main')
  .sort()

const prText = capture('gh', [
  'pr', 'list', '--state', 'all', '--limit', '2000',
  '--json', 'number,state,isDraft,mergedAt,closedAt,headRefName,baseRefName,url,title,updatedAt',
], { cwd: repoRoot })
const prs = prText ? JSON.parse(prText) : []

const lifecycle = branches.map((branch) => {
  const isAncestorOfMain = succeeds('git', [
    'merge-base', '--is-ancestor', `origin/${branch}`, main,
  ], { cwd: repoRoot })
  const classification = classifyBranchLifecycle({ branch, isAncestorOfMain, prs })
  return {
    ...classification,
    managed: /^(work|project|multi)\//.test(branch),
    studioSession: parseWorkBranch(branch),
  }
})

const activeTaskGroups = new Map()
for (const item of lifecycle) {
  if (item.state === 'integrated' || !item.studioSession) continue
  const key = `${item.studioSession.projectId}/${item.studioSession.task}`
  const group = activeTaskGroups.get(key) || []
  group.push(item.branch)
  activeTaskGroups.set(key, group)
}
const duplicateClaims = [...activeTaskGroups.entries()]
  .filter(([, groupedBranches]) => groupedBranches.length > 1)
  .map(([task, groupedBranches]) => ({ task, branches: groupedBranches.sort() }))
  .sort((a, b) => a.task.localeCompare(b.task))

const deleted = []
const deleteFailures = []
if (cleanupMerged) {
  for (const item of lifecycle) {
    if (!item.managed || !item.safeToDelete) continue
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

const counts = lifecycle.reduce((acc, item) => {
  acc[item.state] = (acc[item.state] || 0) + 1
  return acc
}, {})

const result = {
  ok: deleteFailures.length === 0,
  observedMain: main,
  branchCount: lifecycle.length,
  counts,
  duplicateClaims,
  cleanupMerged,
  deleted,
  deleteFailures,
  branches: lifecycle,
  policy: {
    activePr: 'keep',
    integratedManagedBranch: cleanupMerged ? 'delete remote branch' : 'safe cleanup candidate',
    closedUnmerged: 'preserve until unique work is reviewed or explicitly abandoned',
    orphanUnique: 'preserve and recover into a PR or explicitly abandon',
  },
}

console.log(JSON.stringify(result, null, 2))
if (deleteFailures.length) process.exit(1)
