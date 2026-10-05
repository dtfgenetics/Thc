import { readFileSync } from 'node:fs'
import { createHash } from 'node:crypto'
import { resolveResourceSet } from './resources.mjs'
import { resolveVerificationProfile } from './routing.mjs'
import { resolveCanonicalRepository, resolveProjectRepository } from './repositories.mjs'

const PLAN_MARKER_RE = /<!-- worker-plan:(\{.*?\}) -->/s

export function loadConfig(path = 'data/worker-orchestrator.json') {
  const config = JSON.parse(readFileSync(path, 'utf8'))
  validateConfig(config)
  return config
}

export function validateConfig(config) {
  if (!config || ![1, 2].includes(config.version)) throw new Error('worker orchestrator config version must be 1 or 2')
  if (!Number.isInteger(config.maxWorkers) || config.maxWorkers < 1) throw new Error('maxWorkers must be a positive integer')
  if (!Number.isInteger(config.maxWorkersPerProject) || config.maxWorkersPerProject < 1) throw new Error('maxWorkersPerProject must be a positive integer')
  if (!Number.isInteger(config.maxScopedWorkersPerProject || config.maxWorkersPerProject) || (config.maxScopedWorkersPerProject || config.maxWorkersPerProject) < 1) throw new Error('maxScopedWorkersPerProject must be a positive integer when set')
  if (!config.labels?.ready || !config.labels?.claimed || !config.labels?.blocked || !config.labels?.done) throw new Error('ready/claimed/blocked/done labels are required')
  if (!config.workerKinds || Object.keys(config.workerKinds).length === 0) throw new Error('at least one worker kind is required')

  if (config.version >= 2) {
    if (!config.lease || !Number.isFinite(config.lease.ttlMinutes) || config.lease.ttlMinutes <= 0) throw new Error('lease.ttlMinutes must be positive')
    if (!Number.isFinite(config.lease.heartbeatGraceMinutes) || config.lease.heartbeatGraceMinutes < 0) throw new Error('lease.heartbeatGraceMinutes must be non-negative')
    if (!Number.isInteger(config.lease.maxAttempts) || config.lease.maxAttempts < 0) throw new Error('lease.maxAttempts must be a non-negative integer')
    for (const required of ['running', 'verifying', 'retry', 'stale', 'failed', 'quarantined', 'integrationReady']) {
      if (!config.labels?.[required]) throw new Error(`labels.${required} is required for config version 2`)
    }
  }
  return config
}

export function leaseTtlMinutes(config) {
  if (config.version >= 2) return config.lease.ttlMinutes
  return config.claimTtlMinutes || 240
}

export function maxAttempts(config) {
  if (config.version >= 2) return config.lease.maxAttempts
  return 3
}

export function slug(value, max = 42) {
  const normalized = String(value || '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, max)
  return normalized || 'task'
}

function cleanStringArray(value) {
  return Array.isArray(value)
    ? [...new Set(value.map((item) => String(item || '').trim()).filter(Boolean))]
    : []
}

export function planMetadataFromIssue(issue) {
  const match = String(issue?.body || '').match(PLAN_MARKER_RE)
  if (!match) return {
    resourceSet: [],
    allowedPaths: [],
    verificationProfile: null,
    canonicalDomain: null,
    targetRepository: null,
    productionTargets: [],
    dependencies: [],
    acceptanceCriteria: [],
    productionImpact: false,
  }

  let raw
  try {
    raw = JSON.parse(match[1])
  } catch {
    throw new Error(`Issue #${issue?.number ?? '?'} has malformed worker-plan JSON`)
  }

  return {
    resourceSet: cleanStringArray(raw.resourceSet),
    allowedPaths: cleanStringArray(raw.allowedPaths),
    verificationProfile: raw.verificationProfile ? String(raw.verificationProfile).trim() : null,
    canonicalDomain: raw.canonicalDomain ? String(raw.canonicalDomain).trim() : null,
    targetRepository: raw.targetRepository ? String(raw.targetRepository).trim() : null,
    productionTargets: cleanStringArray(raw.productionTargets),
    dependencies: cleanStringArray(raw.dependencies),
    acceptanceCriteria: cleanStringArray(raw.acceptanceCriteria),
    productionImpact: Boolean(raw.productionImpact || cleanStringArray(raw.productionTargets).length),
  }
}

export function resourceSetsOverlap(a = [], b = []) {
  const left = new Set(cleanStringArray(a))
  return cleanStringArray(b).some((resource) => left.has(resource))
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

export function buildClaim(issue, config) {
  const project = projectFromIssue(issue)
  const kind = workerKindFromIssue(issue, config)
  const prefix = config.workerKinds[kind]?.branchPrefix || 'work'
  const id = String(issue.number)
  const digest = createHash('sha1').update(`${id}:${issue.title || ''}`).digest('hex').slice(0, 7)
  const branch = `${prefix}/${project}/${slug(issue.title, 32)}-i${id}-${digest}`
  const metadata = planMetadataFromIssue(issue)
  const inferredProjectOwner = !metadata.canonicalDomain && !metadata.targetRepository
    ? resolveProjectRepository(project)
    : null
  const owner = resolveCanonicalRepository({
    canonicalDomain: metadata.canonicalDomain,
    explicitRepository: metadata.targetRepository || inferredProjectOwner?.repository || null,
    controlRepository: config.controlRepository || 'dtfgenetics/Thc',
  })

  let allowedPaths
  let productionTargets
  let verificationProfile

  if (owner.external) {
    if (metadata.resourceSet.length === 0) {
      throw new Error(`Issue #${issue.number} external canonical work requires a non-empty resourceSet`)
    }
    if (metadata.allowedPaths.length === 0) {
      throw new Error(`Issue #${issue.number} external canonical work requires explicit allowedPaths`)
    }
    if (!metadata.verificationProfile) {
      throw new Error(`Issue #${issue.number} external canonical work requires explicit verificationProfile`)
    }
    allowedPaths = [...new Set(metadata.allowedPaths)].sort()
    productionTargets = [...new Set(metadata.productionTargets)].sort()
    verificationProfile = metadata.verificationProfile
  } else {
    const resolved = resolveResourceSet(metadata.resourceSet)
    if (resolved.unknown.length) {
      throw new Error(`Issue #${issue.number} references unknown resources: ${resolved.unknown.join(', ')}`)
    }
    allowedPaths = [...new Set([...resolved.allowedPaths, ...metadata.allowedPaths])].sort()
    productionTargets = [...new Set([...resolved.productionTargets, ...metadata.productionTargets])].sort()
    verificationProfile = resolveVerificationProfile(metadata.resourceSet, metadata.verificationProfile)
  }

  return {
    issueNumber: Number(issue.number),
    title: issue.title,
    project,
    kind,
    branch,
    base: config.baseBranch || 'main',
    ...metadata,
    repository: owner.repository,
    canonicalDomain: owner.canonicalDomain,
    externalRepository: owner.external,
    dispatchMode: owner.external ? 'external-executor' : 'local',
    dispatchable: !owner.external,
    verificationProfile,
    allowedPaths,
    productionTargets,
    productionImpact: Boolean(metadata.productionImpact || productionTargets.length),
  }
}

export function dependencyIssueNumber(value) {
  const match = /^(?:issue-|#)?(\d+)$/.exec(String(value || '').trim())
  return match ? Number(match[1]) : null
}

export function dependenciesSatisfied(dependencies = [], satisfiedDependencies = []) {
  const satisfied = new Set((satisfiedDependencies || []).map((value) => String(value)))
  return (dependencies || []).every((dependency) => {
    const issueNumber = dependencyIssueNumber(dependency)
    if (!issueNumber) return false
    return satisfied.has(String(issueNumber))
  })
}

export function dependencyBlockers(dependencies = [], satisfiedDependencies = []) {
  const satisfied = new Set((satisfiedDependencies || []).map((value) => String(value)))
  return (dependencies || []).filter((dependency) => {
    const issueNumber = dependencyIssueNumber(dependency)
    return !issueNumber || !satisfied.has(String(issueNumber))
  })
}

export function planClaims(issues, activeClaims, config, satisfiedDependencies = []) {
  const active = activeClaims.filter((item) => item.active !== false)
  const available = Math.max(0, config.maxWorkers - active.length)
  if (available === 0) return []

  const projectState = new Map()
  for (const claim of active) {
    const project = claim.project || 'general'
    if (!projectState.has(project)) projectState.set(project, { total: 0, scoped: 0, unscoped: 0 })
    const state = projectState.get(project)
    state.total += 1
    if (cleanStringArray(claim.resourceSet).length) state.scoped += 1
    else state.unscoped += 1
  }

  const activeResources = active.flatMap((claim) => cleanStringArray(claim.resourceSet))
  const plannedResources = []
  const plannedProjectState = new Map()
  const selected = []

  const candidates = issues
    .filter((issue) => isReady(issue, config))
    .sort((a, b) => priorityRank(a, config) - priorityRank(b, config) || new Date(a.created_at || 0) - new Date(b.created_at || 0) || Number(a.number) - Number(b.number))
    .map((issue) => buildClaim(issue, config))

  for (const claim of candidates) {
    if (selected.length >= available) break

    if (!dependenciesSatisfied(claim.dependencies, satisfiedDependencies)) continue

    if (
      claim.resourceSet.length > 0 &&
      (resourceSetsOverlap(claim.resourceSet, activeResources) || resourceSetsOverlap(claim.resourceSet, plannedResources))
    ) {
      continue
    }

    const activeState = projectState.get(claim.project) || { total: 0, scoped: 0, unscoped: 0 }
    const plannedState = plannedProjectState.get(claim.project) || { total: 0, scoped: 0, unscoped: 0 }
    const scoped = claim.resourceSet.length > 0

    if (!scoped) {
      if (activeState.total + plannedState.total >= config.maxWorkersPerProject) continue
      if (activeState.total + plannedState.total > 0) continue
    } else {
      if (activeState.unscoped + plannedState.unscoped > 0) continue
      const scopedLimit = config.maxScopedWorkersPerProject || config.maxWorkersPerProject
      if (activeState.scoped + plannedState.scoped >= scopedLimit) continue
    }

    if (!plannedProjectState.has(claim.project)) plannedProjectState.set(claim.project, { total: 0, scoped: 0, unscoped: 0 })
    const nextState = plannedProjectState.get(claim.project)
    nextState.total += 1
    if (scoped) nextState.scoped += 1
    else nextState.unscoped += 1

    selected.push(claim)
    plannedResources.push(...claim.resourceSet)
  }

  return selected
}

export function isReady(issue, config) {
  if (issue.pull_request) return false
  if (issue.state && issue.state !== 'open') return false
  const labels = new Set((issue.labels || []).map(labelName))
  const disallowed = [
    config.labels.claimed,
    config.labels.running,
    config.labels.verifying,
    config.labels.blocked,
    config.labels.quarantined,
    config.labels.done,
  ].filter(Boolean)
  return labels.has(config.labels.ready) && !disallowed.some((label) => labels.has(label))
}

export function labelName(label) {
  return typeof label === 'string' ? label : label?.name || ''
}
