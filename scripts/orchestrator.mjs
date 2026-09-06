#!/usr/bin/env node

import { execFileSync } from 'node:child_process'
import { loadConfig, planClaims } from './orchestrator/core.mjs'

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
    'api', '--paginate', `repos/${repo}/issues`,
    '-f', 'state=open', '-f', `labels=${config.labels.ready}`, '-f', 'per_page=100',
    '--jq', '[.[] | select(.pull_request == null)]'
  ], [])
}

function listActiveClaims(repo, config) {
  const issues = json([
    'api', '--paginate', `repos/${repo}/issues`,
    '-f', 'state=open', '-f', `labels=${config.labels.claimed}`, '-f', 'per_page=100',
    '--jq', '[.[] | select(.pull_request == null)]'
  ], [])
  return issues.map((issue) => {
    const marker = String(issue.body || '').match(/<!-- worker-orchestrator:(\{.*?\}) -->/s)
    if (!marker) return { issueNumber: issue.number, project: 'general', active: true }
    try {
      const payload = JSON.parse(marker[1])
      return { issueNumber: issue.number, project: payload.project || 'general', active: true, ...payload }
    } catch {
      return { issueNumber: issue.number, project: 'general', active: true }
    }
  })
}

function ensureLabel(repo, name, color, description) {
  capture(['label', 'create', name, '--repo', repo, '--color', color, '--description', description], { allowFailure: true })
}

function ensureLabels(repo, config) {
  ensureLabel(repo, config.labels.ready, '0E8A16', 'Ready for worker orchestration')
  ensureLabel(repo, config.labels.claimed, 'FBCA04', 'Claimed by worker orchestrator')
  ensureLabel(repo, config.labels.blocked, 'B60205', 'Worker cannot proceed safely')
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

function claimIssue(repo, claim, config) {
  const issue = json(['api', `repos/${repo}/issues/${claim.issueNumber}`])
  const labels = new Set((issue.labels || []).map((label) => label.name))
  if (!labels.has(config.labels.ready) || labels.has(config.labels.claimed)) throw new Error(`Issue #${claim.issueNumber} is no longer claimable`)

  const baseSha = createBranch(repo, claim)
  const payload = { ...claim, baseSha, claimedAt: new Date().toISOString(), runId: process.env.GITHUB_RUN_ID || null }
  const marker = `<!-- worker-orchestrator:${JSON.stringify(payload)} -->`
  const body = `${String(issue.body || '').replace(/\n?<!-- worker-orchestrator:\{.*?\} -->/s, '').trim()}\n\n${marker}`.trim()

  capture(['issue', 'edit', String(claim.issueNumber), '--repo', repo, '--add-label', config.labels.claimed, '--body', body])
  capture(['issue', 'comment', String(claim.issueNumber), '--repo', repo, '--body', [
    `Worker claimed this task as **${claim.kind}** work.`,
    '',
    `- Branch: \`${claim.branch}\``,
    `- Base: \`${claim.base}\` at \`${baseSha}\``,
    `- Project lane: \`${claim.project}\``,
    '',
    'The branch is single-purpose. Completion must return through a pull request and the existing integration gate; direct writes to `main` are not permitted by orchestrator policy.'
  ].join('\n')])

  return payload
}

const { command, options } = parseArgs(process.argv.slice(2))
const repo = repoFromEnvOrGh()
const config = loadConfig(options.config || 'data/worker-orchestrator.json')

if (command === 'labels') {
  ensureLabels(repo, config)
  console.log(JSON.stringify({ ok: true, repo, labelsEnsured: true }, null, 2))
  process.exit(0)
}

const ready = listReadyIssues(repo, config)
const active = listActiveClaims(repo, config)
const plan = planClaims(ready, active, config)

if (command === 'status' || command === 'plan') {
  console.log(JSON.stringify({
    ok: true,
    repo,
    mode: command,
    maxWorkers: config.maxWorkers,
    activeWorkers: active.length,
    availableWorkers: Math.max(0, config.maxWorkers - active.length),
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
    console.log(JSON.stringify({ ok: true, repo, mode: 'dispatch-dry-run', plannedClaims: plan }, null, 2))
    process.exit(0)
  }

  const claimed = []
  const failures = []
  for (const claim of plan) {
    try {
      claimed.push(claimIssue(repo, claim, config))
    } catch (error) {
      failures.push({ issueNumber: claim.issueNumber, error: error.message })
    }
  }
  console.log(JSON.stringify({ ok: failures.length === 0, repo, mode: 'dispatch', claimed, failures }, null, 2))
  process.exit(failures.length ? 1 : 0)
}

console.error('Usage: node scripts/orchestrator.mjs <plan|status|labels|dispatch> [--apply=true] [--config=path]')
process.exit(2)
