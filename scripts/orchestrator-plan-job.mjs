#!/usr/bin/env node

import { execFileSync } from 'node:child_process'
import { buildClaim, loadConfig } from './orchestrator/core.mjs'

const PLAN_MARKER_RE = /<!-- worker-plan:(\{.*?\}) -->/s

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

function list(value) {
  if (!value) return []
  return [...new Set(String(value).split('|').map((item) => item.trim()).filter(Boolean))]
}

function replacePlanMarker(body, plan) {
  const marker = `<!-- worker-plan:${JSON.stringify(plan)} -->`
  const stripped = String(body || '').replace(/\n?<!-- worker-plan:\{.*?\} -->/s, '').trim()
  return `${stripped}\n\n${marker}`.trim()
}

function ensureLabel(repo, name, color, description) {
  if (!name) return
  capture(['label', 'create', name, '--repo', repo, '--color', color, '--description', description], { allowFailure: true })
}

function issueNumber(options) {
  const value = Number(options.issue)
  if (!Number.isInteger(value) || value <= 0) throw new Error('--issue=<number> is required')
  return value
}

const options = parseArgs(process.argv.slice(2))
const repo = repoFromEnvOrGh()
const config = loadConfig(options.config || 'data/worker-orchestrator.json')
const number = issueNumber(options)
const apply = options.apply === 'true'
const ready = options.ready === 'true'

try {
  const issue = json(['api', `repos/${repo}/issues/${number}`])
  if (!issue || issue.pull_request) throw new Error(`Issue #${number} is missing or is a pull request`)
  if (issue.state !== 'open') throw new Error(`Issue #${number} must be open`)

  const currentLabels = new Set((issue.labels || []).map((label) => label.name))
  for (const blocking of [
    config.labels.claimed,
    config.labels.running,
    config.labels.verifying,
    config.labels.integrationReady,
    config.labels.done,
  ].filter(Boolean)) {
    if (currentLabels.has(blocking)) throw new Error(`Issue #${number} cannot be re-planned while labeled ${blocking}`)
  }

  const project = String(options.project || '').trim()
  if (!project) throw new Error('--project=<name> is required')
  const workerKind = String(options['worker-kind'] || 'code').trim()
  if (!config.workerKinds?.[workerKind]) throw new Error(`Unknown worker kind: ${workerKind}`)

  const plan = {
    planVersion: 1,
    canonicalDomain: options['canonical-domain'] ? String(options['canonical-domain']).trim() : null,
    targetRepository: options['target-repository'] ? String(options['target-repository']).trim() : null,
    resourceSet: list(options.resources),
    allowedPaths: list(options['allowed-paths']),
    verificationProfile: options['verification-profile'] ? String(options['verification-profile']).trim() : null,
    dependencies: list(options.dependencies),
    acceptanceCriteria: list(options.acceptance),
    productionTargets: list(options['production-targets']),
    productionImpact: options['production-impact'] === 'true' || list(options['production-targets']).length > 0,
  }

  if (plan.acceptanceCriteria.length === 0) throw new Error('At least one acceptance criterion is required')
  if (plan.resourceSet.length === 0) throw new Error('At least one resource is required for new planned jobs')

  const projectLabel = `project:${project}`
  const workerLabel = config.workerKinds[workerKind].label
  const priority = options.priority ? String(options.priority).trim() : null
  if (priority && !(config.priorities || []).includes(`priority:${priority.replace(/^priority:/, '')}`)) {
    throw new Error(`Unknown priority: ${priority}`)
  }
  const priorityLabel = priority ? `priority:${priority.replace(/^priority:/, '')}` : null

  const plannedBody = replacePlanMarker(issue.body, plan)
  const synthetic = {
    ...issue,
    body: plannedBody,
    labels: [
      ...(issue.labels || []),
      { name: projectLabel },
      { name: workerLabel },
      ...(priorityLabel ? [{ name: priorityLabel }] : []),
    ],
  }

  const claim = buildClaim(synthetic, config)
  const result = {
    ok: true,
    repo,
    issueNumber: number,
    apply,
    ready,
    project,
    workerKind,
    plan,
    resolved: {
      repository: claim.repository,
      canonicalDomain: claim.canonicalDomain,
      dispatchMode: claim.dispatchMode,
      resourceSet: claim.resourceSet,
      allowedPaths: claim.allowedPaths,
      verificationProfile: claim.verificationProfile,
      productionTargets: claim.productionTargets,
      branch: claim.branch,
    },
  }

  if (!apply) {
    console.log(JSON.stringify(result, null, 2))
    process.exit(0)
  }

  ensureLabel(repo, projectLabel, '0052CC', `Project lane: ${project}`)
  ensureLabel(repo, workerLabel, '1D76DB', `Worker kind: ${workerKind}`)
  if (priorityLabel) ensureLabel(repo, priorityLabel, 'D93F0B', `Worker priority: ${priorityLabel}`)

  const editArgs = ['issue', 'edit', String(number), '--repo', repo, '--body', plannedBody, '--add-label', projectLabel, '--add-label', workerLabel]
  if (priorityLabel) editArgs.push('--add-label', priorityLabel)
  if (ready) editArgs.push('--add-label', config.labels.ready)
  capture(editArgs)

  capture(['issue', 'comment', String(number), '--repo', repo, '--body', [
    'Validated worker plan recorded.',
    '',
    `- Canonical repository: \`${claim.repository}\``,
    `- Dispatch mode: \`${claim.dispatchMode}\``,
    `- Resources: \`${claim.resourceSet.join(', ')}\``,
    `- Verification: \`${claim.verificationProfile}\``,
    `- Planned branch: \`${claim.branch}\``,
    `- Ready for dispatch: **${ready ? 'yes' : 'no'}**`,
  ].join('\n')])

  console.log(JSON.stringify(result, null, 2))
} catch (error) {
  console.error(JSON.stringify({ ok: false, repo, issueNumber: number, error: error.message }, null, 2))
  process.exit(1)
}
