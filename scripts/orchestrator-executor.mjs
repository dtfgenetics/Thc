#!/usr/bin/env node

import { execFileSync } from 'node:child_process'
import { loadConfig, leaseTtlMinutes } from './orchestrator/core.mjs'
import { buildExecutionPacket, buildHandoffPacket, claimExecutor, executorHandoff, executorResult, heartbeatExecutor, renderHandoffMarkdown } from './orchestrator/executor.mjs'
import { validateJob } from './orchestrator/state.mjs'
import { inspectContractScope, validateAgentContract } from './orchestrator/repo-contract.mjs'

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
  const output = capture(args, { allowFailure: fallback !== null })
  return output ? JSON.parse(output) : fallback
}

function parseArgs(argv) {
  const [command = 'packet', ...rest] = argv
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

function parseMarker(body) {
  const match = String(body || '').match(MARKER_RE)
  if (!match) return null
  try { return JSON.parse(match[1]) } catch { return null }
}

function replaceMarker(body, payload) {
  const marker = `<!-- worker-orchestrator:${JSON.stringify(payload)} -->`
  return `${String(body || '').replace(/\n?<!-- worker-orchestrator:\{.*?\} -->/s, '').trim()}\n\n${marker}`.trim()
}

function issueNumber(options) {
  const value = Number(options.issue)
  if (!Number.isInteger(value) || value <= 0) throw new Error('--issue=<number> is required')
  return value
}

function loadJob(repo, options) {
  const number = issueNumber(options)
  const issue = json(['api', `repos/${repo}/issues/${number}`])
  const job = parseMarker(issue.body)
  if (!job) throw new Error(`Issue #${number} has no orchestrator marker`)
  validateJob(job)
  return { issue, job, number }
}

function saveJob(repo, issue, job) {
  const body = replaceMarker(issue.body, job)
  capture(['issue', 'edit', String(issue.number), '--repo', repo, '--body', body])
}

function listOption(value) {
  if (!value) return []
  return String(value).split('|').map((item) => item.trim()).filter(Boolean)
}

function fetchAgentContract(targetRepo, controlRepo) {
  const raw = capture([
    'api',
    `repos/${targetRepo}/contents/dtf-agent-contract.json`,
    '-H', 'Accept: application/vnd.github.raw+json',
  ])
  const contract = JSON.parse(raw)
  return validateAgentContract(contract, {
    expectedRepository: targetRepo,
    expectedControlRepository: controlRepo,
  })
}

const { command, options } = parseArgs(process.argv.slice(2))
const repo = repoFromEnvOrGh()
const config = loadConfig(options.config || 'data/worker-orchestrator.json')

try {
  const { issue, job, number } = loadJob(repo, options)

  if (command === 'packet') {
    console.log(JSON.stringify({ ok: true, repo, mode: 'packet', packet: buildExecutionPacket(job, { issueNumber: number }) }, null, 2))
    process.exit(0)
  }


  if (command === 'provision') {
    if ((job.dispatchMode || 'local') !== 'external-executor') {
      throw new Error('provision is only valid for external-executor jobs')
    }
    if (job.branchProvisioned !== false) {
      throw new Error('target branch is already provisioned')
    }
    const targetRepo = job.repository
    if (!targetRepo) throw new Error('job.repository is required for external provisioning')
    if (!job.branch) throw new Error('job.branch is required for external provisioning')
    const contract = fetchAgentContract(targetRepo, repo)
    const contractGate = inspectContractScope(job, contract)
    if (!contractGate.ok) {
      throw new Error(`target repository agent contract rejected job: ${contractGate.violations.map((item) => `${item.code}: ${item.detail}`).join('; ')}`)
    }
    const existing = capture(['api', `repos/${targetRepo}/git/ref/heads/${job.branch}`, '--jq', '.ref'], { allowFailure: true })
    if (existing) throw new Error(`Refusing to reuse existing external branch ${job.branch}`)
    const baseSha = capture(['api', `repos/${targetRepo}/git/ref/heads/${job.baseBranch || 'main'}`, '--jq', '.object.sha'])
    capture([
      'api', '--method', 'POST', `repos/${targetRepo}/git/refs`,
      '-f', `ref=refs/heads/${job.branch}`,
      '-f', `sha=${baseSha}`,
    ])
    const next = {
      ...job,
      baseSha,
      branchProvisioned: true,
      agentContract: {
        schemaVersion: contract.schemaVersion,
        repository: contract.repository,
        defaultBranch: contract.defaultBranch,
        canonicalDomain: job.canonicalDomain || null,
        verificationProfile: contractGate.verificationProfile,
        production: contract.production,
        validatedAt: new Date().toISOString(),
      },
      updatedAt: new Date().toISOString(),
      history: [
        ...(Array.isArray(job.history) ? job.history : []),
        { from: job.state, to: job.state, at: new Date().toISOString(), event: 'external-branch-provisioned', repository: targetRepo, branch: job.branch, baseSha },
      ],
    }
    saveJob(repo, issue, next)
    console.log(JSON.stringify({ ok: true, repo, mode: 'provision', targetRepository: targetRepo, contractGate, job: next }, null, 2))
    process.exit(0)
  }

  const executorId = options['executor-id']
  if (!executorId) throw new Error('--executor-id=<id> is required')

  if (command === 'claim') {
    const next = claimExecutor(job, {
      executorId,
      provider: options.provider || 'external',
      sessionId: options['session-id'] || null,
      ttlMinutes: leaseTtlMinutes(config),
    })
    saveJob(repo, issue, next)
    capture(['issue', 'comment', String(number), '--repo', repo, '--body', [
      `Executor **${executorId}** claimed this job.`,
      '',
      `- Provider: \`${options.provider || 'external'}\``,
      `- Worker kind: \`${next.workerKind}\``,
      `- Branch: \`${next.branch}\``,
      `- Lease: \`${next.lease?.leaseId}\``,
      `- State: \`${next.state}\``,
    ].join('\n')])
    console.log(JSON.stringify({ ok: true, repo, mode: 'claim', job: next, packet: buildExecutionPacket(next, { issueNumber: number }) }, null, 2))
    process.exit(0)
  }

  const leaseId = options['lease-id']
  if (!leaseId) throw new Error('--lease-id=<id> is required')

  if (command === 'heartbeat') {
    const next = heartbeatExecutor(job, {
      executorId,
      leaseId,
      ttlMinutes: leaseTtlMinutes(config),
      progress: options.progress || null,
      headSha: options['head-sha'] || null,
    })
    saveJob(repo, issue, next)
    console.log(JSON.stringify({ ok: true, repo, mode: 'heartbeat', job: next }, null, 2))
    process.exit(0)
  }

  if (command === 'handoff') {
    const next = executorHandoff(job, {
      executorId,
      leaseId,
      completed: listOption(options.completed),
      remaining: listOption(options.remaining),
      blockers: listOption(options.blockers),
      headSha: options['head-sha'] || null,
    })
    saveJob(repo, issue, next)
    const handoffMarkdown = renderHandoffMarkdown(next, { issueNumber: number })
    capture(['issue', 'comment', String(number), '--repo', repo, '--body', handoffMarkdown])
    console.log(JSON.stringify({
      ok: true,
      repo,
      mode: 'handoff',
      job: next,
      handoff: buildHandoffPacket(next, { issueNumber: number }),
    }, null, 2))
    process.exit(0)
  }

  if (command === 'result') {
    const next = executorResult(job, {
      executorId,
      leaseId,
      outcome: options.outcome,
      headSha: options['head-sha'] || null,
      prNumber: options.pr ? Number(options.pr) : null,
      verificationEvidence: listOption(options.evidence),
      failure: options.failure || null,
    })
    saveJob(repo, issue, next)
    console.log(JSON.stringify({ ok: true, repo, mode: 'result', job: next }, null, 2))
    process.exit(0)
  }

  throw new Error('Usage: node scripts/orchestrator-executor.mjs <packet|provision|claim|heartbeat|handoff|result> --issue=N [--executor-id=id] [--lease-id=id]')
} catch (error) {
  console.error(JSON.stringify({ ok: false, repo, mode: command, error: error.message }, null, 2))
  process.exit(1)
}
