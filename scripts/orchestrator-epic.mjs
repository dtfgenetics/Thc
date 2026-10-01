#!/usr/bin/env node

import { execFileSync } from 'node:child_process'
import { readFileSync } from 'node:fs'
import { buildClaim, loadConfig, slug } from './orchestrator/core.mjs'
import { epicSummary, materializeJobPlan, topologicalJobOrder, validateEpicManifest } from './orchestrator/epics.mjs'

function capture(args, { allowFailure = false } = {}) {
  try {
    return execFileSync('gh', args, { encoding: 'utf8', maxBuffer: 24 * 1024 * 1024 }).trim()
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

function ensureLabel(repo, name, color, description) {
  if (!name) return
  capture(['label', 'create', name, '--repo', repo, '--color', color, '--description', description], { allowFailure: true })
}

function planMarker(plan) {
  return `<!-- worker-plan:${JSON.stringify(plan)} -->`
}

function jobBody({ epicNumber = null, epicTitle, job, plan }) {
  const deps = (job.dependencies || []).length ? (job.dependencies || []).map((dep) => `- ${dep}`).join('\n') : '- None'
  const criteria = (job.acceptanceCriteria || []).map((item) => `- [ ] ${item}`).join('\n')
  return [
    `## Goal\n\n${job.goal}`,
    '',
    '## Parent epic',
    '',
    epicNumber ? `#${epicNumber} — ${epicTitle}` : epicTitle,
    '',
    '## Canonical owner',
    '',
    `- Canonical domain: ${job.canonicalDomain || 'control repository / resolved resource ownership'}`,
    `- Target repository: ${job.targetRepository || 'resolve from canonical domain / control repository'}`,
    `- Resource(s): ${(job.resourceSet || []).join(', ')}`,
    '',
    '## Scope',
    '',
    ...(job.allowedPaths?.length ? job.allowedPaths.map((path) => `- ${path}`) : ['- Derived from resource registry when local']),
    '',
    '## Manifest dependencies',
    '',
    deps,
    '',
    '## Acceptance criteria',
    '',
    criteria,
    '',
    '## Verification',
    '',
    `- Profile: ${job.verificationProfile || 'auto-route when local'}`,
    '',
    planMarker(plan),
  ].join('\n')
}

function createIssue(repo, { title, body, labels }) {
  const args = ['api', '--method', 'POST', `repos/${repo}/issues`, '-f', `title=${title}`, '-f', `body=${body}`]
  for (const label of labels) args.push('-f', `labels[]=${label}`)
  return json(args)
}

function updateIssue(repo, number, { body }) {
  capture(['api', '--method', 'PATCH', `repos/${repo}/issues/${number}`, '-f', `body=${body}`])
}

const options = parseArgs(process.argv.slice(2))
const repo = repoFromEnvOrGh()
const config = loadConfig(options.config || 'data/worker-orchestrator.json')
const manifestPath = options.manifest
const apply = options.apply === 'true'
const ready = options.ready === 'true'

if (!manifestPath) {
  console.error('Usage: node scripts/orchestrator-epic.mjs --manifest=path.json [--apply=true] [--ready=true]')
  process.exit(2)
}

try {
  const manifest = validateEpicManifest(JSON.parse(readFileSync(manifestPath, 'utf8')))
  const ordered = topologicalJobOrder(manifest)
  const fakeIssueNumbers = new Map(ordered.map((job, index) => [job.key, 900000 + index]))
  const resolved = []

  for (let index = 0; index < ordered.length; index += 1) {
    const job = ordered[index]
    if (!config.workerKinds?.[job.workerKind]) throw new Error(`Unknown worker kind for ${job.key}: ${job.workerKind}`)
    const project = job.project || manifest.epic.project
    const projectLabel = `project:${project}`
    const workerLabel = config.workerKinds[job.workerKind].label
    const plan = materializeJobPlan(job, fakeIssueNumbers)
    const body = jobBody({ epicTitle: manifest.epic.title, job, plan })
    const synthetic = {
      number: 900000 + index,
      title: `[JOB] ${job.title}`,
      body,
      state: 'open',
      labels: [{ name: projectLabel }, { name: workerLabel }],
    }
    const claim = buildClaim(synthetic, config)
    resolved.push({
      key: job.key,
      title: job.title,
      project,
      workerKind: job.workerKind,
      repository: claim.repository,
      dispatchMode: claim.dispatchMode,
      resourceSet: claim.resourceSet,
      allowedPaths: claim.allowedPaths,
      verificationProfile: claim.verificationProfile,
      dependencies: job.dependencies || [],
      branch: claim.branch,
    })
  }

  const preview = {
    ok: true,
    repo,
    apply,
    ready,
    epic: epicSummary(manifest),
    resolved,
  }

  if (!apply) {
    console.log(JSON.stringify(preview, null, 2))
    process.exit(0)
  }

  const epicProjectLabel = `project:${manifest.epic.project}`
  ensureLabel(repo, 'type:epic', '6F42C1', 'Parent work item containing dependency-linked worker jobs')
  ensureLabel(repo, epicProjectLabel, '0052CC', `Project lane: ${manifest.epic.project}`)
  if (manifest.epic.system) ensureLabel(repo, `system:${slug(manifest.epic.system, 30)}`, '0E8A16', `System: ${manifest.epic.system}`)
  for (const job of ordered) {
    const project = job.project || manifest.epic.project
    ensureLabel(repo, `project:${project}`, '0052CC', `Project lane: ${project}`)
    ensureLabel(repo, config.workerKinds[job.workerKind].label, '1D76DB', `Worker kind: ${job.workerKind}`)
  }

  const epicLabels = ['type:epic', epicProjectLabel]
  if (manifest.epic.system) epicLabels.push(`system:${slug(manifest.epic.system, 30)}`)
  const epicIssue = createIssue(repo, {
    title: `[EPIC] ${manifest.epic.title}`,
    body: [
      '## Goal',
      '',
      manifest.epic.goal,
      '',
      '## Project',
      '',
      manifest.epic.project,
      '',
      '## System',
      '',
      manifest.epic.system || 'Unspecified',
      '',
      '## Child jobs',
      '',
      'Child jobs are created only after the complete manifest passes validation.',
    ].join('\n'),
    labels: epicLabels,
  })

  const created = []
  const issueNumbersByKey = new Map()

  for (const job of ordered) {
    const project = job.project || manifest.epic.project
    const plan = materializeJobPlan(job, issueNumbersByKey)
    const labels = [`project:${project}`, config.workerKinds[job.workerKind].label]
    if (ready) labels.push(config.labels.ready)
    const createdIssue = createIssue(repo, {
      title: `[JOB] ${job.title}`,
      body: jobBody({ epicNumber: epicIssue.number, epicTitle: manifest.epic.title, job, plan }),
      labels,
    })
    issueNumbersByKey.set(job.key, createdIssue.number)
    created.push({
      key: job.key,
      issueNumber: createdIssue.number,
      url: createdIssue.html_url,
      dependencies: (job.dependencies || []).map((key) => issueNumbersByKey.get(key)),
    })
  }

  const childLines = created.map((item) => `- [ ] #${item.issueNumber} — ${manifest.jobs.find((job) => job.key === item.key)?.title || item.key}`)
  updateIssue(repo, epicIssue.number, {
    body: [
      '## Goal',
      '',
      manifest.epic.goal,
      '',
      '## Project',
      '',
      manifest.epic.project,
      '',
      '## System',
      '',
      manifest.epic.system || 'Unspecified',
      '',
      '## Child jobs',
      '',
      ...childLines,
      '',
      `Ready labels applied: **${ready ? 'yes' : 'no'}**`,
    ].join('\n'),
  })

  console.log(JSON.stringify({
    ...preview,
    epicIssue: { number: epicIssue.number, url: epicIssue.html_url },
    createdJobs: created,
  }, null, 2))
} catch (error) {
  console.error(JSON.stringify({ ok: false, repo, manifest: manifestPath, error: error.message }, null, 2))
  process.exit(1)
}
