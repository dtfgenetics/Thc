#!/usr/bin/env node

import { execFileSync } from 'node:child_process'
import { readFileSync } from 'node:fs'
import { applyRepairPlan, planRepair } from './orchestrator/repair.mjs'
import { transitionJob, validateJob } from './orchestrator/state.mjs'
import { classifyVerificationFailure, exactHeadMatches, inspectAllowedPaths, inspectCheckRollup } from './orchestrator/verification.mjs'

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

function loadVerificationProfile(job, path = 'configuration/orchestrator/verification-profiles.json') {
  const config = JSON.parse(readFileSync(path, 'utf8'))
  if (config.schemaVersion !== 1) throw new Error('verification profiles schemaVersion must be 1')
  const name = job.verificationProfile || 'repo-control'
  const profile = config.profiles?.[name]
  if (!profile) throw new Error(`Unknown verification profile: ${name}`)
  return { name, profile }
}

function inspect(repo, issueNumber, profilePath) {
  const issue = json(['api', `repos/${repo}/issues/${issueNumber}`])
  const job = parseMarker(issue.body)
  if (!job) throw new Error(`Issue #${issueNumber} has no orchestrator marker`)
  validateJob(job)
  if (job.state !== 'PR_OPEN') throw new Error(`Issue #${issueNumber} must be PR_OPEN before exact-head verification; found ${job.state}`)
  if (!Number.isInteger(Number(job.prNumber)) || Number(job.prNumber) <= 0) throw new Error('Job has no valid prNumber')

  const targetRepo = job.repository || repo
  const external = targetRepo !== repo
  const { name: profileName, profile } = external
    ? { name: job.verificationProfile || 'external-required-checks', profile: { requiresExactHead: true } }
    : loadVerificationProfile(job, profilePath)
  const pr = json([
    'pr', 'view', String(job.prNumber), '--repo', targetRepo,
    '--json', 'number,state,headRefOid,baseRefName,statusCheckRollup,url,files'
  ])
  if (pr.state !== 'OPEN') throw new Error(`PR #${pr.number} must be OPEN for verification; found ${pr.state}`)
  if (!pr.headRefOid) throw new Error(`PR #${pr.number} has no head SHA`)

  const expected = job.expectedHeadSha || null
  if (!exactHeadMatches(expected, pr.headRefOid, profile.requiresExactHead !== false)) {
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
      targetRepo,
    }
  }

  const pathGate = inspectAllowedPaths((pr.files || []).map((file) => file.path), job.allowedPaths || [])
  if (!pathGate.ok) {
    return {
      ok: false,
      reason: pathGate.reason,
      profileName,
      expectedHeadSha: expected,
      currentHeadSha: pr.headRefOid,
      pr,
      pathGate,
      checkGate: null,
      issue,
      job,
      targetRepo,
    }
  }

  const checkGate = inspectCheckRollup(pr.statusCheckRollup || [])
  return {
    ok: checkGate.ok,
    reason: checkGate.ok ? 'exact-head-checks-passing' : checkGate.reason,
    profileName,
    expectedHeadSha: expected,
    currentHeadSha: pr.headRefOid,
    pr,
    pathGate,
    checkGate,
    issue,
    job,
    targetRepo,
  }
}

function apply(repo, inspection, retryPath = 'configuration/orchestrator/retry-policies.json') {
  if (!inspection.ok) {
    const retryConfig = JSON.parse(readFileSync(retryPath, 'utf8'))
    const failure = classifyVerificationFailure(inspection)
    const plan = planRepair(inspection.job, failure, retryConfig)
    const next = applyRepairPlan(inspection.job, failure, plan)
    const body = replaceMarker(inspection.issue.body, next)
    capture(['issue', 'edit', String(inspection.issue.number), '--repo', repo, '--body', body])
    return next
  }
  const now = new Date().toISOString()
  const prepared = {
    ...inspection.job,
    expectedHeadSha: inspection.currentHeadSha,
    verification: {
      profile: inspection.profileName,
      headSha: inspection.currentHeadSha,
      checkedAt: now,
      checks: inspection.checkGate.checks.map(({ name, conclusion, status }) => ({ name, conclusion, status })),
      allowedPathGate: inspection.pathGate ? {
        allowed: inspection.pathGate.allowed,
        changed: inspection.pathGate.changed,
        violations: inspection.pathGate.violations,
      } : null,
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
  const job = applyChanges ? apply(repo, inspection, options.retries || 'configuration/orchestrator/retry-policies.json') : inspection.job
  console.log(JSON.stringify({
    ok: inspection.ok,
    repo,
    targetRepository: inspection.targetRepo || repo,
    mode: applyChanges ? 'check-apply' : 'check-dry-run',
    issueNumber,
    profile: inspection.profileName,
    expectedHeadSha: inspection.expectedHeadSha,
    currentHeadSha: inspection.currentHeadSha,
    reason: inspection.reason,
    pathGate: inspection.pathGate || null,
    checks: inspection.checkGate?.checks || [],
    failure: inspection.ok ? null : classifyVerificationFailure(inspection),
    job,
  }, null, 2))
  process.exit(applyChanges ? 0 : (inspection.ok ? 0 : 1))
} catch (error) {
  console.error(JSON.stringify({ ok: false, repo, issueNumber, error: error.message }, null, 2))
  process.exit(1)
}
