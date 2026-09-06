#!/usr/bin/env node

import { execFileSync } from 'node:child_process'
import { loadConfig, planClaims, leaseTtlMinutes, maxAttempts } from './orchestrator/core.mjs'
import { createLease, heartbeatLease, isLeaseExpired } from './orchestrator/leases.mjs'
import { newJob, transitionJob } from './orchestrator/state.mjs'

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
  const [command = 'plan', ...rest] = argv
  const options = Object.fromEntries(rest.filter((arg) => arg.startsWith('--')).map((arg) => {
    const raw = arg.slice(2)
    const at = raw.indexOf('=')
    return at === -1 ? [raw, 'true'] : [raw.slice(0, at), raw.slice(at + 1)]
  }))
  return { command, options }
}

function repoFromEnvOrGh() {
  if (process.env.GITHUB_REPOSITORY) return process.env.GITHUB_REPOSITORY
  return capture(['repo', 'view', '--json', 'nameWithOwner', '--jq', '.nameWithOwner'])
}

function listReadyIssues(repo, config) {
  return json([
    'api', '--method', 'GET', '--paginate', `repos/${repo}/issues`,
    '-f', 'state=open', '-f', `labels=${config.labels.ready}`, '-f', 'per_page=100',
    '--jq', '[.[] | select(.pull_request == null)]'
  ], [])
}

function parseMarker(issue) {
  const marker = String(issue?.body || '').match(MARKER_RE)
  if (!marker) return null
  try {
    return JSON.parse(marker[1])
  } catch {
    return null
  }
}

function replaceMarker(body, payload) {
  const marker = `<!-- worker-orchestrator:${JSON.stringify(payload)} -->`
  return `${String(body || '').replace(/\n?<!-- worker-orchestrator:\{.*?\} -->/s, '').trim()}\n\n${marker}`.trim()
}

function editIssueBody(repo, issue, payload) {
  const body = replaceMarker(issue.body, payload)
  capture(['issue', 'edit', String(issue.number), '--repo', repo, '--body', body])
}

function listActiveClaims(repo, config) {
  const issues = json([
    'api', '--method', 'GET', '--paginate', `repos/${repo}/issues`,
    '-f', 'state=open', '-f', `labels=${config.labels.claimed}`, '-f', 'per_page=100',
    '--jq', '[.[] | select(.pull_request == null)]'
  ], [])
  return issues.map((issue) => {
    const payload = parseMarker(issue)
    if (!payload) return { issueNumber: issue.number, project: 'general', active: true, malformed: true }
    const expired = payload.lease ? isLeaseExpired(payload.lease) : false
    return {
      issueNumber: issue.number,
      project: payload.project || 'general',
      active: payload.lease ? !expired : true,
      expired,
      ...payload,
    }
  })
}

function ensureLabel(repo, name, color, description) {
  if (!name) return
  capture(['label', 'create', name, '--repo', repo, '--color', color, '--description', description], { allowFailure: true })
}

function ensureLabels(repo, config) {
  ensureLabel(repo, config.labels.ready, '0E8A16', 'Ready for worker orchestration')
  ensureLabel(repo, config.labels.claimed, 'FBCA04', 'Claimed by worker orchestrator')
  ensureLabel(repo, config.labels.running, 'D4C5F9', 'Worker is actively running')
  ensureLabel(repo, config.labels.verifying, 'BFDADC', 'Worker output is being verified')
  ensureLabel(repo, config.labels.retry, 'FEF2C0', 'Worker task waiting to retry')
  ensureLabel(repo, config.labels.stale, 'E4E669', 'Worker lease expired or state is stale')
  ensureLabel(repo, config.labels.blocked, 'B60205', 'Worker cannot proceed safely')
  ensureLabel(repo, config.labels.failed, 'D93F0B', 'Worker attempt failed')
  ensureLabel(repo, config.labels.quarantined, '5319E7', 'Worker task quarantined after bounded retries')
  ensureLabel(repo, config.labels.integrationReady, '0E8A16', 'Verified and ready for integration')
  ensureLabel(repo, config.labels.done, '5319E7', 'Worker task completed and integrated')
  for (const [kind, entry] of Object.entries(config.workerKinds)) {
    ensureLabel(repo, entry.label, '1D76DB', `Worker kind: ${kind}`)
  }
}

function branchExists(repo, branch) {
  return Boolean(capture(['api', `repos/${repo}/git/ref/heads/${branch}`, '--jq', '.ref'], { allowFailure: true }))
}

function createBranch(repo, claim) {
  if (branchExists(repo, claim.branch)) throw new Error(`Refusing to reuse existing branch ${claim.branch}`)
  const baseSha = capture(['api', `repos/${repo}/git/ref/heads/${claim.base}`, '--jq', '.object.sha'])
  capture(['api', '--method', 'POST', `repos/${repo}/git/refs`, '-f', `ref=refs/heads/${claim.branch}`, '-f', `sha=${baseSha}`])
  return baseSha
}

function claimIssue(repo, claim, config, workerId) {
  const issue = json(['api', `repos/${repo}/issues/${claim.issueNumber}`])
  const labels = new Set((issue.labels || []).map((label) => label.name))
  if (!labels.has(config.labels.ready) || labels.has(config.labels.claimed)) throw new Error(`Issue #${claim.issueNumber} is no longer claimable`)

  const baseSha = createBranch(repo, claim)
  const lease = createLease({ workerId, workerKind: claim.kind, ttlMinutes: leaseTtlMinutes(config) })
  let job = newJob({
    jobId: `issue-${claim.issueNumber}`,
    issueId: claim.issueNumber,
    title: claim.title,
    state: 'READY',
    project: claim.project,
    repository: repo,
    workerKind: claim.kind,
    branch: claim.branch,
    baseBranch: claim.base,
    baseSha,
    maxAttempts: maxAttempts(config),
  })
  job = transitionJob({ ...job, lease }, 'LEASED', { event: 'dispatch' })
  const payload = { ...job, runId: process.env.GITHUB_RUN_ID || null }
  editIssueBody(repo, issue, payload)

  capture(['issue', 'edit', String(claim.issueNumber), '--repo', repo, '--add-label', config.labels.claimed])
  capture(['issue', 'comment', String(claim.issueNumber), '--repo', repo, '--body', [
    `Worker leased this task as **${claim.kind}** work.`,
    '',
    `- Branch: \`${claim.branch}\``,
    `- Base: \`${claim.base}\` at \`${baseSha}\``,
    `- Project lane: \`${claim.project}\``,
    `- Worker: \`${workerId}\``,
    `- Lease: \`${lease.leaseId}\` until \`${lease.expiresAt}\``,
    '',
    'Completion must return through a pull request and the existing integration gate; direct writes to `main` are not permitted by orchestrator policy.'
  ].join('\n')])

  return payload
}

function requireIssueOption(options) {
  const value = Number(options.issue)
  if (!Number.isInteger(value) || value <= 0) throw new Error('--issue=<number> is required')
  return value
}

function lifecycleIssue(repo, options) {
  const issueNumber = requireIssueOption(options)
  const issue = json(['api', `repos/${repo}/issues/${issueNumber}`])
  const job = parseMarker(issue)
  if (!job || job.schemaVersion !== 2) throw new Error(`Issue #${issueNumber} has no V2 orchestrator job marker`)
  return { issue, job }
}

function startJob(repo, options, config) {
  const { issue, job } = lifecycleIssue(repo, options)
  const workerId = options.worker || process.env.GITHUB_RUN_ID || 'manual-worker'
  const leaseId = options['lease-id']
  if (!leaseId) throw new Error('--lease-id=<id> is required')
  if (!job.lease) throw new Error('Job has no active lease')
  if (job.lease.leaseId !== leaseId || job.lease.workerId !== workerId) throw new Error('Lease ownership does not match')
  if (isLeaseExpired(job.lease)) throw new Error('Lease has expired; reconcile before starting')
  const next = transitionJob(job, 'RUNNING', { event: 'start' })
  editIssueBody(repo, issue, next)
  if (config.labels.running) capture(['issue', 'edit', String(issue.number), '--repo', repo, '--add-label', config.labels.running])
  return next
}

function heartbeatJob(repo, options, config) {
  const { issue, job } = lifecycleIssue(repo, options)
  const workerId = options.worker || process.env.GITHUB_RUN_ID || 'manual-worker'
  const leaseId = options['lease-id']
  if (!leaseId) throw new Error('--lease-id=<id> is required')
  const lease = heartbeatLease(job.lease, { leaseId, workerId, ttlMinutes: leaseTtlMinutes(config) })
  const next = { ...job, lease, updatedAt: new Date().toISOString() }
  editIssueBody(repo, issue, next)
  return next
}

const { command, options } = parseArgs(process.argv.slice(2))
const repo = repoFromEnvOrGh()
const config = loadConfig(options.config || 'data/worker-orchestrator.json')

if (command === 'labels') {
  ensureLabels(repo, config)
  console.log(JSON.stringify({ ok: true, repo, labelsEnsured: true }, null, 2))
  process.exit(0)
}

if (command === 'start') {
  try {
    const job = startJob(repo, options, config)
    console.log(JSON.stringify({ ok: true, repo, mode: 'start', job }, null, 2))
    process.exit(0)
  } catch (error) {
    console.error(JSON.stringify({ ok: false, repo, mode: 'start', error: error.message }, null, 2))
    process.exit(1)
  }
}

if (command === 'heartbeat') {
  try {
    const job = heartbeatJob(repo, options, config)
    console.log(JSON.stringify({ ok: true, repo, mode: 'heartbeat', job }, null, 2))
    process.exit(0)
  } catch (error) {
    console.error(JSON.stringify({ ok: false, repo, mode: 'heartbeat', error: error.message }, null, 2))
    process.exit(1)
  }
}

const ready = listReadyIssues(repo, config)
const active = listActiveClaims(repo, config)
const liveActive = active.filter((claim) => claim.active !== false)
const expired = active.filter((claim) => claim.expired)
const plan = planClaims(ready, liveActive, config)

if (command === 'status' || command === 'plan') {
  console.log(JSON.stringify({
    ok: true,
    repo,
    mode: command,
    configVersion: config.version,
    maxWorkers: config.maxWorkers,
    activeWorkers: liveActive.length,
    expiredClaims: expired.length,
    availableWorkers: Math.max(0, config.maxWorkers - liveActive.length),
    readyIssues: ready.length,
    plannedClaims: plan,
    activeClaims: active,
  }, null, 2))
  process.exit(0)
}

if (command === 'dispatch') {
  ensureLabels(repo, config)
  const apply = options.apply === 'true'
  if (!apply) {
    console.log(JSON.stringify({ ok: true, repo, mode: 'dispatch-dry-run', plannedClaims: plan, expiredClaims: expired }, null, 2))
    process.exit(0)
  }

  if (config.safety?.reconcileBeforeDispatch && expired.length > 0) {
    console.error(JSON.stringify({
      ok: false,
      repo,
      mode: 'dispatch',
      error: 'Expired worker leases require reconciliation before dispatch',
      expiredClaims: expired.map((item) => ({ issueNumber: item.issueNumber, branch: item.branch, lease: item.lease })),
    }, null, 2))
    process.exit(1)
  }

  const workerId = options.worker || (process.env.GITHUB_RUN_ID ? `github-run:${process.env.GITHUB_RUN_ID}` : 'manual-worker')
  const claimed = []
  const failures = []
  for (const claim of plan) {
    try {
      claimed.push(claimIssue(repo, claim, config, workerId))
    } catch (error) {
      failures.push({ issueNumber: claim.issueNumber, error: error.message })
    }
  }
  console.log(JSON.stringify({ ok: failures.length === 0, repo, mode: 'dispatch', workerId, claimed, failures }, null, 2))
  process.exit(failures.length ? 1 : 0)
}

console.error('Usage: node scripts/orchestrator.mjs <plan|status|labels|dispatch|start|heartbeat> [--apply=true] [--issue=N] [--worker=id] [--lease-id=id] [--config=path]')
process.exit(2)
