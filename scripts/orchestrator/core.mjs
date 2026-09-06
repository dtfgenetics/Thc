import { readFileSync } from 'node:fs'
import { createHash } from 'node:crypto'

export function loadConfig(path = 'data/worker-orchestrator.json') {
  const config = JSON.parse(readFileSync(path, 'utf8'))
  validateConfig(config)
  return config
}

export function validateConfig(config) {
  if (!config || config.version !== 1) throw new Error('worker orchestrator config version must be 1')
  if (!Number.isInteger(config.maxWorkers) || config.maxWorkers < 1) throw new Error('maxWorkers must be a positive integer')
  if (!Number.isInteger(config.maxWorkersPerProject) || config.maxWorkersPerProject < 1) throw new Error('maxWorkersPerProject must be a positive integer')
  if (!config.labels?.ready || !config.labels?.claimed || !config.labels?.blocked || !config.labels?.done) throw new Error('ready/claimed/blocked/done labels are required')
  if (!config.workerKinds || Object.keys(config.workerKinds).length === 0) throw new Error('at least one worker kind is required')
  return config
}

export function slug(value, max = 42) {
  const normalized = String(value || '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, max)
  return normalized || 'task'
}

export function projectFromIssue(issue) {
  const projectLabel = (issue.labels || []).map(labelName).find((name) => name.startsWith('project:'))
  if (projectLabel) return slug(projectLabel.slice('project:'.length), 30)
  return 'general'
}

export function workerKindFromIssue(issue, config) {
  const labels = new Set((issue.labels || []).map(labelName))
  for (const [kind, entry] of Object.entries(config.workerKinds)) {
    if (labels.has(entry.label)) return kind
  }
  return 'code'
}

export function priorityRank(issue, config) {
  const labels = new Set((issue.labels || []).map(labelName))
  const index = (config.priorities || []).findIndex((label) => labels.has(label))
  return index === -1 ? (config.priorities || []).length : index
}

export function planClaims(issues, activeClaims, config) {
  const active = activeClaims.filter((item) => item.active !== false)
  const available = Math.max(0, config.maxWorkers - active.length)
  if (available === 0) return []

  const perProject = new Map()
  for (const claim of active) {
    const project = claim.project || 'general'
    perProject.set(project, (perProject.get(project) || 0) + 1)
  }

  return issues
    .filter((issue) => isReady(issue, config))
    .sort((a, b) => priorityRank(a, config) - priorityRank(b, config) || new Date(a.created_at || 0) - new Date(b.created_at || 0) || Number(a.number) - Number(b.number))
    .filter((issue) => {
      const project = projectFromIssue(issue)
      const count = perProject.get(project) || 0
      if (count >= config.maxWorkersPerProject) return false
      perProject.set(project, count + 1)
      return true
    })
    .slice(0, available)
    .map((issue) => buildClaim(issue, config))
}

export function buildClaim(issue, config) {
  const project = projectFromIssue(issue)
  const kind = workerKindFromIssue(issue, config)
  const prefix = config.workerKinds[kind]?.branchPrefix || 'work'
  const id = String(issue.number)
  const digest = createHash('sha1').update(`${id}:${issue.title || ''}`).digest('hex').slice(0, 7)
  const branch = `${prefix}/${project}/${slug(issue.title, 32)}-i${id}-${digest}`
  return {
    issueNumber: Number(issue.number),
    title: issue.title,
    project,
    kind,
    branch,
    base: config.baseBranch || 'main',
  }
}

export function isReady(issue, config) {
  if (issue.pull_request) return false
  if (issue.state && issue.state !== 'open') return false
  const labels = new Set((issue.labels || []).map(labelName))
  return labels.has(config.labels.ready)
    && !labels.has(config.labels.claimed)
    && !labels.has(config.labels.blocked)
    && !labels.has(config.labels.done)
}

export function labelName(label) {
  return typeof label === 'string' ? label : label?.name || ''
}
