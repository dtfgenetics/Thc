#!/usr/bin/env node

import { execFileSync } from 'node:child_process'
import { classifyReconciliation } from './orchestrator/reconcile.mjs'
import { clearLease } from './orchestrator/leases.mjs'
import { validateJob } from './orchestrator/state.mjs'

const MARKER_RE = /<!-- worker-orchestrator:(\{.*?\}) -->/s

function capture(args, { allowFailure = false } = {}) {
  try {
    return execFileSync('gh', args, { encoding: 'utf8', maxBuffer: 16 * 1024 * 1024 }).trim()
  } catch (error) {
    if (allowFailure) return ''
    throw error
  }
}

function json(args, fallback = null) {
  const text = capture(args, { allowFailure: fallback !== null })
  return text ? JSON.parse(text) : fallback
}

function parseArgs(argv) {
  const options = Object.fromEntries(argv.filter((arg) => arg.startsWith('--')).map((arg) => {
    const raw = arg.slice(2)
    const at = raw.indexOf('=')
    return at === -1 ? [raw, 'true'] : [raw.slice(0, at), raw.slice(at + 1)]
  }))
  return options
}

function repoFromEnvOrGh() {
  if (process.env.GITHUB_REPOSITORY) return process.env.GITHUB_REPOSITORY
  return capture(['repo', 'view', '--json', 'nameWithOwner', '--jq', '.nameWithOwner'])
}

function parseMarker(body) {
  const marker = String(body || '').match(MARKER_RE)
  if (!marker) return null
  try { return JSON.parse(marker[1]) } catch { return null }
}

function replaceMarker(body, payload) {
  const marker = `<!-- worker-orchestrator:${JSON.stringify(payload)} -->`
  return `${String(body || '').replace(/\n?<!-- worker-orchestrator:\{.*?\} -->/s, '').trim()}\n\n${marker}`.trim()
}

function issue(repo, number) {
  return json(['api', `repos/${repo}/issues/${number}`])
}

function branchInfo(repo, branch) {
  if (!branch) return { exists: false, sha: null }
  const encoded = encodeURIComponent(branch)
  const data = json(['api', `repos/${repo}/git/ref/heads/${encoded}`], null)
  return data ? { exists: true, sha: data.object?.sha || null } : { exists: false, sha: null }
}

function uniqueCommits(repo, base, branch) {
  if (!base || !branch) return 0
  const endpoint = `repos/${repo}/compare/${encodeURIComponent(base)}...${encodeURIComponent(branch)}`
  const data = json(['api', endpoint], null)
  return Number(data?.ahead_by || 0)
}

function prsForBranch(repo, branch) {
  if (!branch) return []
  return json([
    'pr', 'list', '--repo', repo, '--head', branch, '--state', 'all', '--limit', '20',
    '--json', 'number,state,mergedAt,mergeCommit,headRefName,headRefOid,url'
  ], [])
}

function normalizePr(pr) {
  if (!pr) return null
  return {
    number: pr.number,
    state: pr.state,
    mergedAt: pr.mergedAt || null,
    merge_commit_sha: pr.mergeCommit?.oid || null,
    headSha: pr.headRefOid || null,
    url: pr.url || null,
  }
}

function inspect(repo, issueNumber, now = new Date()) {
  const rawIssue = issue(repo, issueNumber)
  const job = parseMarker(rawIssue.body)
  if (!job) throw new Error(`Issue #${issueNumber} has no orchestrator marker`)
  validateJob(job)

  const branch = branchInfo(repo, job.branch)
  const ahead = branch.exists ? uniqueCommits(repo, job.baseBranch || 'main', job.branch) : 0
  const prs = prsForBranch(repo, job.branch)
  const mergedPr = normalizePr(prs.find((pr) => pr.mergedAt))
  const openPr = normalizePr(prs.find((pr) => pr.state === 'OPEN'))
  const result = classifyReconciliation({
    job,
    branchExists: branch.exists,
    uniqueCommits: ahead,
    openPr,
    mergedPr,
    deploymentInProgress: ['DEPLOYING', 'LIVE_VERIFYING'].includes(job.state),
    now,
  })

  return { issue: rawIssue, job, branch, uniqueCommits: ahead, openPr, mergedPr, result }
}

function history(job, event, details = {}) {
  return [...(Array.isArray(job.history) ? job.history : []), {
    from: job.state,
    to: details.state || job.state,
    at: new Date().toISOString(),
    event,
    ...details,
  }]
}

function reconciled(job, result, inspection) {
  const now = new Date().toISOString()
  const base = { ...job, updatedAt: now, reconciliation: { action: result.action, reason: result.reason, at: now } }

  if (result.action === 'ACTIVE' || result.action === 'NOOP') return base

  if (result.action === 'REQUEUE') {
    const next = clearLease({ ...base, state: 'READY' })
    return { ...next, history: history(job, 'reconcile-requeue', { state: 'READY' }) }
  }

  if (result.action === 'RECOVER_BRANCH') {
    const next = clearLease({ ...base, state: 'REPAIRING' })
    return { ...next, history: history(job, 'reconcile-recover-branch', { state: 'REPAIRING', branch: job.branch }) }
  }

  if (result.action === 'PRESERVE_PR') {
    const pr = inspection.openPr
    const next = clearLease({ ...base, state: 'PR_OPEN', prNumber: pr.number, expectedHeadSha: pr.headSha || job.expectedHeadSha })
    return { ...next, history: history(job, 'reconcile-open-pr', { state: 'PR_OPEN', prNumber: pr.number }) }
  }

  if (result.action === 'MARK_MERGED') {
    const pr = inspection.mergedPr
    const nextState = job.productionImpact ? 'MERGED' : 'MERGED'
    const next = clearLease({ ...base, state: nextState, prNumber: pr.number, mergeSha: pr.merge_commit_sha || null })
    return { ...next, history: history(job, 'reconcile-merged-pr', { state: nextState, prNumber: pr.number, mergeSha: pr.merge_commit_sha || null }) }
  }

  if (result.action === 'BLOCK_RELEASE' || result.action === 'BLOCK') {
    const next = { ...base, state: 'BLOCKED' }
    return { ...next, history: history(job, 'reconcile-blocked', { state: 'BLOCKED', reason: result.reason }) }
  }

  if (result.action === 'ORPHAN_BRANCH') return base

  return { ...base, state: 'BLOCKED', history: history(job, 'reconcile-unknown-action', { state: 'BLOCKED', action: result.action }) }
}

function apply(repo, inspection) {
  const result = inspection.result
  if (result.action === 'ORPHAN_BRANCH') throw new Error('Orphan branch reconciliation requires an owning job and is report-only')
  if (['ACTIVE', 'NOOP'].includes(result.action)) return inspection.job

  const next = reconciled(inspection.job, result, inspection)
  const body = replaceMarker(inspection.issue.body, next)
  capture(['issue', 'edit', String(inspection.issue.number), '--repo', repo, '--body', body])
  return next
}

const options = parseArgs(process.argv.slice(2))
const repo = repoFromEnvOrGh()
const issueNumber = Number(options.issue)
if (!Number.isInteger(issueNumber) || issueNumber <= 0) {
  console.error('Usage: node scripts/orchestrator-reconcile.mjs --issue=N [--apply=true]')
  process.exit(2)
}

try {
  const inspection = inspect(repo, issueNumber)
  const applyChanges = options.apply === 'true'
  const job = applyChanges ? apply(repo, inspection) : inspection.job
  console.log(JSON.stringify({
    ok: true,
    repo,
    mode: applyChanges ? 'reconcile-apply' : 'reconcile-dry-run',
    issueNumber,
    branch: inspection.branch,
    uniqueCommits: inspection.uniqueCommits,
    openPr: inspection.openPr,
    mergedPr: inspection.mergedPr,
    reconciliation: inspection.result,
    job,
  }, null, 2))
} catch (error) {
  console.error(JSON.stringify({ ok: false, repo, issueNumber, error: error.message }, null, 2))
  process.exit(1)
}
