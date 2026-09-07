#!/usr/bin/env node

import { execFileSync } from 'node:child_process'
import { loadConfig } from './orchestrator/core.mjs'
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
  return Object.fromEntries(argv.filter((arg) => arg.startsWith('--')).map((arg) => {
    const raw = arg.slice(2)
    const at = raw.indexOf('=')
    return at === -1 ? [raw, 'true'] : [raw.slice(0, at), raw.slice(at + 1)]
  }))
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

function issuesWithLabel(repo, label) {
  if (!label) return []
  return json([
    'api', '--method', 'GET', '--paginate', `repos/${repo}/issues`,
    '-f', 'state=open', '-f', `labels=${label}`, '-f', 'per_page=100',
    '--jq', '[.[] | select(.pull_request == null)]'
  ], [])
}

function reconciliationIssues(repo, config) {
  const byNumber = new Map()
  for (const item of [...issuesWithLabel(repo, config.labels.claimed), ...issuesWithLabel(repo, config.labels.stale)]) {
    byNumber.set(Number(item.number), item)
  }
  return [...byNumber.values()].sort((a, b) => Number(a.number) - Number(b.number))
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
    const next = clearLease({ ...base, state: 'MERGED', prNumber: pr.number, mergeSha: pr.merge_commit_sha || null })
    return { ...next, history: history(job, 'reconcile-merged-pr', { state: 'MERGED', prNumber: pr.number, mergeSha: pr.merge_commit_sha || null }) }
  }

  if (result.action === 'BLOCK_RELEASE' || result.action === 'BLOCK') {
    const next = clearLease({ ...base, state: 'BLOCKED' })
    return { ...next, history: history(job, 'reconcile-blocked', { state: 'BLOCKED', reason: result.reason }) }
  }

  if (result.action === 'ORPHAN_BRANCH') return base

  const next = clearLease({ ...base, state: 'BLOCKED' })
  return { ...next, history: history(job, 'reconcile-unknown-action', { state: 'BLOCKED', action: result.action }) }
}

function editLabels(repo, issueNumber, add = [], remove = []) {
  for (const label of remove.filter(Boolean)) {
    capture(['issue', 'edit', String(issueNumber), '--repo', repo, '--remove-label', label], { allowFailure: true })
  }
  for (const label of add.filter(Boolean)) {
    capture(['issue', 'edit', String(issueNumber), '--repo', repo, '--add-label', label], { allowFailure: true })
  }
}

function syncLabels(repo, issueNumber, config, job) {
  const transient = [
    config.labels.claimed, config.labels.running, config.labels.verifying, config.labels.retry,
    config.labels.stale, config.labels.blocked, config.labels.failed, config.labels.quarantined,
    config.labels.integrationReady, config.labels.done,
  ]
  let add = []
  if (job.state === 'READY') add = [config.labels.ready]
  else if (job.state === 'REPAIRING' || job.state === 'LEASE_EXPIRED') add = [config.labels.stale]
  else if (job.state === 'BLOCKED') add = [config.labels.blocked]
  else if (job.state === 'INTEGRATION_READY') add = [config.labels.integrationReady]
  else if (job.state === 'DONE') add = [config.labels.done]
  editLabels(repo, issueNumber, add, transient.filter((label) => !add.includes(label)))
}

function apply(repo, inspection, config) {
  const result = inspection.result
  if (result.action === 'ORPHAN_BRANCH') throw new Error('Orphan branch reconciliation requires an owning job and is report-only')
  if (['ACTIVE', 'NOOP'].includes(result.action)) return inspection.job

  const next = reconciled(inspection.job, result, inspection)
  const body = replaceMarker(inspection.issue.body, next)
  capture(['issue', 'edit', String(inspection.issue.number), '--repo', repo, '--body', body])
  syncLabels(repo, inspection.issue.number, config, next)
  return next
}

function reconcileOne(repo, issueNumber, config, applyChanges) {
  const inspection = inspect(repo, issueNumber)
  const job = applyChanges ? apply(repo, inspection, config) : inspection.job
  return {
    ok: true,
    issueNumber,
    branch: inspection.branch,
    uniqueCommits: inspection.uniqueCommits,
    openPr: inspection.openPr,
    mergedPr: inspection.mergedPr,
    reconciliation: inspection.result,
    job,
  }
}

function reconcileAll(repo, config, applyChanges) {
  const candidates = reconciliationIssues(repo, config)
  const results = []
  const failures = []
  for (const candidate of candidates) {
    try {
      results.push(reconcileOne(repo, Number(candidate.number), config, applyChanges))
    } catch (error) {
      failures.push({ issueNumber: Number(candidate.number), error: error.message })
    }
  }
  return { candidates: candidates.length, results, failures }
}

const options = parseArgs(process.argv.slice(2))
const repo = repoFromEnvOrGh()
const config = loadConfig(options.config || 'data/worker-orchestrator.json')
const applyChanges = options.apply === 'true'
const all = options.all === 'true'
const issueNumber = Number(options.issue)

if (!all && (!Number.isInteger(issueNumber) || issueNumber <= 0)) {
  console.error('Usage: node scripts/orchestrator-reconcile.mjs (--issue=N | --all=true) [--apply=true] [--config=path]')
  process.exit(2)
}

try {
  if (all) {
    const sweep = reconcileAll(repo, config, applyChanges)
    console.log(JSON.stringify({
      ok: sweep.failures.length === 0,
      repo,
      mode: applyChanges ? 'reconcile-all-apply' : 'reconcile-all-dry-run',
      ...sweep,
    }, null, 2))
    process.exit(sweep.failures.length ? 1 : 0)
  }

  const result = reconcileOne(repo, issueNumber, config, applyChanges)
  console.log(JSON.stringify({
    ok: true,
    repo,
    mode: applyChanges ? 'reconcile-apply' : 'reconcile-dry-run',
    ...result,
  }, null, 2))
} catch (error) {
  console.error(JSON.stringify({ ok: false, repo, issueNumber: all ? null : issueNumber, error: error.message }, null, 2))
  process.exit(1)
}
