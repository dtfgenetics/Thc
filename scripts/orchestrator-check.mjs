#!/usr/bin/env node

import { execFileSync } from 'node:child_process'
import { readFileSync } from 'node:fs'
import { transitionJob, validateJob } from './orchestrator/state.mjs'

const MARKER_RE = /<!-- worker-orchestrator:(\{.*?\}) -->/s
const PASSING = new Set(['SUCCESS', 'NEUTRAL', 'SKIPPED'])

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

function loadVerificationProfile(job, path = 'configuration/orchestrator/verification-profiles.json') {
  const config = JSON.parse(readFileSync(path, 'utf8'))
  if (config.schemaVersion !== 1) throw new Error('verification profiles schemaVersion must be 1')
  const name = job.verificationProfile || 'repo-control'
  const profile = config.profiles?.[name]
  if (!profile) throw new Error(`Unknown verification profile: ${name}`)
  return { name, profile }
}

function normalizeCheck(entry) {
  const name = entry.name || entry.context || entry.workflowName || 'unnamed-check'
  const status = String(entry.status || entry.state || '').toUpperCase()
  const conclusion = String(entry.conclusion || entry.state || '').toUpperCase()
  const completed = status === 'COMPLETED' || PASSING.has(conclusion) || ['FAILURE', 'CANCELLED', 'TIMED_OUT', 'ACTION_REQUIRED', 'STALE'].includes(conclusion)
  return { name, status, conclusion, completed }
}

function inspectChecks(pr) {
  const checks = (pr.statusCheckRollup || []).map(normalizeCheck)
  if (checks.length === 0) return { ok: false, reason: 'no-checks-reported', checks }
  const pending = checks.filter((check) => !check.completed || (!check.conclusion && !PASSING.has(check.status)))
  if (pending.length) return { ok: false, reason: 'checks-pending', checks, pending }
  const failing = checks.filter((check) => !PASSING.has(check.conclusion || check.status))
  if (failing.length) return { ok: false, reason: 'checks-failing', checks, failing }
  return { ok: true, reason: 'all-reported-checks-passing', checks }
}

function inspect(repo, issueNumber, profilePath) {
  const issue = json(['api', `repos/${repo}/issues/${issueNumber}`])
  const job = parseMarker(issue.body)
  if (!job) throw new Error(`Issue #${issueNumber} has no orchestrator marker`)
  validateJob(job)
  if (job.state !== 'PR_OPEN') throw new Error(`Issue #${issueNumber} must be PR_OPEN before exact-head verification; found ${job.state}`)
  if (!Number.isInteger(Number(job.prNumber)) || Number(job.prNumber) <= 0) throw new Error('Job has no valid prNumber')

  const { name: profileName, profile } = loadVerificationProfile(job, profilePath)
  const pr = json([
    'pr', 'view', String(job.prNumber), '--repo', repo,
    '--json', 'number,state,headRefOid,baseRefName,statusCheckRollup,url'
  ])
  if (pr.state !== 'OPEN') throw new Error(`PR #${pr.number} must be OPEN for verification; found ${pr.state}`)
  if (!pr.headRefOid) throw new Error(`PR #${pr.number} has no head SHA`)

  const expected = job.expectedHeadSha || null
  if (profile.requiresExactHead !== false && expected && expected !== pr.headRefOid) {
    return {
      ok: false,
      reason: 'head-sha-mismatch',
      profileName,
      expectedHeadSha: expected,
      currentHeadSha: pr.headRefOid,
      pr,
      checkGate: null,
      issue,
      job,
    }
  }

  const checkGate = inspectChecks(pr)
  return {
    ok: checkGate.ok,
    reason: checkGate.ok ? 'exact-head-checks-passing' : checkGate.reason,
    profileName,
    expectedHeadSha: expected,
    currentHeadSha: pr.headRefOid,
    pr,
    checkGate,
    issue,
    job,
  }
}

function apply(repo, inspection) {
  if (!inspection.ok) throw new Error(`Verification gate is not passing: ${inspection.reason}`)
  const now = new Date().toISOString()
  const prepared = {
    ...inspection.job,
    expectedHeadSha: inspection.currentHeadSha,
    verification: {
      profile: inspection.profileName,
      headSha: inspection.currentHeadSha,
      checkedAt: now,
      checks: inspection.checkGate.checks.map(({ name, conclusion, status }) => ({ name, conclusion, status })),
    },
  }
  const next = transitionJob(prepared, 'INTEGRATION_READY', { now, event: 'exact-head-verification-passed' })
  const body = replaceMarker(inspection.issue.body, next)
  capture(['issue', 'edit', String(inspection.issue.number), '--repo', repo, '--body', body])
  return next
}

const options = parseArgs(process.argv.slice(2))
const repo = repoFromEnvOrGh()
const issueNumber = Number(options.issue)
if (!Number.isInteger(issueNumber) || issueNumber <= 0) {
  console.error('Usage: node scripts/orchestrator-check.mjs --issue=N [--apply=true] [--profiles=path]')
  process.exit(2)
}

try {
  const inspection = inspect(repo, issueNumber, options.profiles || 'configuration/orchestrator/verification-profiles.json')
  const applyChanges = options.apply === 'true'
  const job = applyChanges ? apply(repo, inspection) : inspection.job
  console.log(JSON.stringify({
    ok: inspection.ok,
    repo,
    mode: applyChanges ? 'check-apply' : 'check-dry-run',
    issueNumber,
    profile: inspection.profileName,
    expectedHeadSha: inspection.expectedHeadSha,
    currentHeadSha: inspection.currentHeadSha,
    reason: inspection.reason,
    checks: inspection.checkGate?.checks || [],
    job,
  }, null, 2))
  process.exit(inspection.ok ? 0 : 1)
} catch (error) {
  console.error(JSON.stringify({ ok: false, repo, issueNumber, error: error.message }, null, 2))
  process.exit(1)
}
