export const NORMAL_STATES = Object.freeze([
  'DISCOVERED', 'PLANNED', 'READY', 'LEASED', 'RUNNING', 'VERIFYING', 'PR_OPEN',
  'INTEGRATION_READY', 'MERGED', 'STAGING', 'PRODUCTION_READY', 'DEPLOYING',
  'LIVE_VERIFYING', 'DONE',
])

export const EXCEPTION_STATES = Object.freeze([
  'BLOCKED', 'RETRY_WAIT', 'REPAIRING', 'CONFLICTED', 'LEASE_EXPIRED',
  'QUARANTINED', 'CANCELLED', 'SUPERSEDED',
])

export const ALL_STATES = Object.freeze([...NORMAL_STATES, ...EXCEPTION_STATES])

const TRANSITIONS = Object.freeze({
  DISCOVERED: ['PLANNED', 'BLOCKED', 'CANCELLED'],
  PLANNED: ['READY', 'BLOCKED', 'CANCELLED', 'SUPERSEDED'],
  READY: ['LEASED', 'BLOCKED', 'CANCELLED', 'SUPERSEDED'],
  LEASED: ['RUNNING', 'LEASE_EXPIRED', 'BLOCKED', 'CANCELLED'],
  RUNNING: ['VERIFYING', 'REPAIRING', 'RETRY_WAIT', 'BLOCKED', 'LEASE_EXPIRED', 'CANCELLED'],
  VERIFYING: ['PR_OPEN', 'REPAIRING', 'RETRY_WAIT', 'BLOCKED', 'QUARANTINED', 'LEASE_EXPIRED'],
  PR_OPEN: ['INTEGRATION_READY', 'REPAIRING', 'CONFLICTED', 'BLOCKED', 'CANCELLED', 'SUPERSEDED'],
  INTEGRATION_READY: ['MERGED', 'REPAIRING', 'CONFLICTED', 'BLOCKED'],
  MERGED: ['DONE', 'STAGING', 'PRODUCTION_READY', 'BLOCKED'],
  STAGING: ['PRODUCTION_READY', 'REPAIRING', 'BLOCKED', 'QUARANTINED'],
  PRODUCTION_READY: ['DEPLOYING', 'BLOCKED', 'CANCELLED'],
  DEPLOYING: ['LIVE_VERIFYING', 'RETRY_WAIT', 'BLOCKED', 'QUARANTINED'],
  LIVE_VERIFYING: ['DONE', 'REPAIRING', 'RETRY_WAIT', 'BLOCKED', 'QUARANTINED'],
  RETRY_WAIT: ['READY', 'LEASED', 'REPAIRING', 'BLOCKED', 'QUARANTINED', 'CANCELLED'],
  REPAIRING: ['VERIFYING', 'PR_OPEN', 'RETRY_WAIT', 'BLOCKED', 'QUARANTINED', 'LEASE_EXPIRED'],
  CONFLICTED: ['REPAIRING', 'RETRY_WAIT', 'BLOCKED', 'CANCELLED', 'SUPERSEDED'],
  LEASE_EXPIRED: ['READY', 'REPAIRING', 'PR_OPEN', 'BLOCKED', 'QUARANTINED', 'CANCELLED'],
  BLOCKED: ['PLANNED', 'READY', 'REPAIRING', 'PRODUCTION_READY', 'CANCELLED', 'SUPERSEDED'],
  QUARANTINED: ['REPAIRING', 'CANCELLED', 'SUPERSEDED'],
  CANCELLED: [],
  SUPERSEDED: [],
  DONE: [],
})

export function validateState(state) {
  if (!ALL_STATES.includes(state)) throw new Error(`Unknown orchestrator state: ${state}`)
  return state
}

export function canTransition(from, to) {
  validateState(from)
  validateState(to)
  return (TRANSITIONS[from] || []).includes(to)
}

export function assertTransition(job, to) {
  const from = validateState(job?.state)
  validateState(to)
  if (!canTransition(from, to)) throw new Error(`Invalid orchestrator transition ${from} -> ${to}`)
  if (to === 'DONE' && job.productionImpact && !['LIVE_VERIFYING'].includes(from)) {
    throw new Error('Production-impacting jobs may reach DONE only from LIVE_VERIFYING')
  }
  return true
}

export function transitionJob(job, to, { now = new Date().toISOString(), event = null } = {}) {
  assertTransition(job, to)
  const history = Array.isArray(job.history) ? [...job.history] : []
  history.push({ from: job.state, to, at: now, ...(event ? { event } : {}) })
  return { ...job, state: to, updatedAt: now, history }
}

export function newJob(input, { now = new Date().toISOString() } = {}) {
  if (!input?.jobId) throw new Error('jobId is required')
  if (!input?.title) throw new Error('title is required')
  const state = input.state || 'DISCOVERED'
  validateState(state)
  return {
    schemaVersion: 2,
    jobId: String(input.jobId),
    issueId: input.issueId ?? null,
    title: String(input.title),
    state,
    project: input.project || null,
    repository: input.repository || null,
    workerKind: input.workerKind || null,
    priority: input.priority || 'p2',
    branch: input.branch || null,
    baseBranch: input.baseBranch || 'main',
    baseSha: input.baseSha || null,
    resourceSet: Array.isArray(input.resourceSet) ? input.resourceSet : [],
    verificationProfile: input.verificationProfile || null,
    retryPolicy: input.retryPolicy || 'implementation',
    attempt: Number.isInteger(input.attempt) ? input.attempt : 0,
    maxAttempts: Number.isInteger(input.maxAttempts) ? input.maxAttempts : 3,
    lease: input.lease || null,
    prNumber: input.prNumber ?? null,
    expectedHeadSha: input.expectedHeadSha || null,
    productionImpact: Boolean(input.productionImpact),
    productionTargets: Array.isArray(input.productionTargets) ? input.productionTargets : [],
    dependencies: Array.isArray(input.dependencies) ? input.dependencies : [],
    acceptanceCriteria: Array.isArray(input.acceptanceCriteria) ? input.acceptanceCriteria : [],
    lastFailure: input.lastFailure || null,
    createdAt: input.createdAt || now,
    updatedAt: now,
    history: Array.isArray(input.history) ? input.history : [],
  }
}

export function validateJob(job) {
  if (!job || job.schemaVersion !== 2) throw new Error('job schemaVersion must be 2')
  if (!job.jobId) throw new Error('jobId is required')
  if (!job.title) throw new Error('title is required')
  validateState(job.state)
  if (!Number.isInteger(job.attempt) || job.attempt < 0) throw new Error('attempt must be a non-negative integer')
  if (!Number.isInteger(job.maxAttempts) || job.maxAttempts < 0) throw new Error('maxAttempts must be a non-negative integer')
  if (!Array.isArray(job.resourceSet)) throw new Error('resourceSet must be an array')
  if (!Array.isArray(job.dependencies)) throw new Error('dependencies must be an array')
  return job
}
