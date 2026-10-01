import { readFileSync } from 'node:fs'
import { heartbeatLease, isLeaseExpired } from './leases.mjs'
import { transitionJob, validateJob } from './state.mjs'

function toIso(value = new Date()) {
  const date = value instanceof Date ? value : new Date(value)
  if (Number.isNaN(date.getTime())) throw new Error(`Invalid timestamp: ${value}`)
  return date.toISOString()
}

export function loadWorkerRegistry(path = 'configuration/orchestrator/workers.json') {
  const config = JSON.parse(readFileSync(path, 'utf8'))
  if (config.schemaVersion !== 1) throw new Error('worker registry schemaVersion must be 1')
  if (!config.workers || typeof config.workers !== 'object') throw new Error('worker registry requires workers')
  return config
}

export function workerSpec(workerKind, config = loadWorkerRegistry()) {
  const spec = config.workers?.[workerKind]
  if (!spec) throw new Error(`Unknown worker kind: ${workerKind}`)
  return spec
}

export function buildExecutionPacket(job, {
  issueNumber = job.issueId,
  workerConfig = loadWorkerRegistry(),
} = {}) {
  validateJob(job)
  const spec = workerSpec(job.workerKind || 'code', workerConfig)
  return {
    schemaVersion: 1,
    jobId: job.jobId,
    issueNumber: issueNumber ?? null,
    repository: job.repository,
    canonicalDomain: job.canonicalDomain || null,
    dispatchMode: job.dispatchMode || 'local',
    branchProvisioned: job.branchProvisioned !== false,
    project: job.project,
    title: job.title,
    state: job.state,
    worker: {
      kind: job.workerKind || 'code',
      class: spec.class,
      capabilities: spec.capabilities || [],
      productionAccess: Boolean(spec.productionAccess),
      requiresProtectedEnvironment: Boolean(spec.requiresProtectedEnvironment),
    },
    branch: {
      name: job.branch,
      base: job.baseBranch,
      baseSha: job.baseSha,
      expectedHeadSha: job.expectedHeadSha,
    },
    scope: {
      resources: job.resourceSet || [],
      allowedPaths: job.allowedPaths || [],
      dependencies: job.dependencies || [],
      acceptanceCriteria: job.acceptanceCriteria || [],
    },
    verification: {
      profile: job.verificationProfile || 'repo-control',
    },
    production: {
      impact: Boolean(job.productionImpact),
      targets: job.productionTargets || [],
    },
    executor: job.executor || null,
    agentContract: job.agentContract || null,
  }
}

export function claimExecutor(job, {
  executorId,
  provider = 'external',
  sessionId = null,
  ttlMinutes = 240,
  now = new Date(),
} = {}) {
  validateJob(job)
  if (!executorId) throw new Error('executorId is required')
  if (job.state !== 'LEASED') throw new Error(`Executor claim requires LEASED state; found ${job.state}`)
  if (job.branchProvisioned === false) throw new Error('Executor claim requires the target branch to be provisioned first')
  if (!job.lease) throw new Error('Job has no dispatcher lease')
  if (isLeaseExpired(job.lease, now)) throw new Error('Dispatcher lease has expired; reconcile before executor claim')
  if (job.executor && !['FAILED', 'HANDED_OFF'].includes(job.executor.status)) {
    throw new Error(`Job already has active executor ${job.executor.executorId || 'unknown'}`)
  }
  if (!Number.isFinite(ttlMinutes) || ttlMinutes <= 0) throw new Error('ttlMinutes must be positive')

  const at = new Date(now)
  const expiresAt = new Date(at.getTime() + ttlMinutes * 60_000).toISOString()
  const executor = {
    executorId: String(executorId),
    provider: String(provider || 'external'),
    sessionId: sessionId ? String(sessionId) : null,
    status: 'RUNNING',
    claimedAt: at.toISOString(),
    heartbeatAt: at.toISOString(),
    lastActivityAt: at.toISOString(),
    lastHeadSha: job.expectedHeadSha || job.baseSha || null,
    progress: null,
  }
  const lease = {
    ...job.lease,
    workerId: String(executorId),
    renewedAt: at.toISOString(),
    expiresAt,
  }
  return transitionJob({ ...job, executor, lease }, 'RUNNING', { now: at.toISOString(), event: 'executor-claimed' })
}

export function heartbeatExecutor(job, {
  executorId,
  leaseId,
  ttlMinutes = 240,
  progress = null,
  headSha = null,
  now = new Date(),
} = {}) {
  validateJob(job)
  if (!job.executor) throw new Error('Job has no attached executor')
  if (job.executor.executorId !== executorId) throw new Error('Executor ID does not match attached executor')
  if (!['RUNNING', 'VERIFYING', 'REPAIRING'].includes(job.state)) {
    throw new Error(`Executor heartbeat is invalid in state ${job.state}`)
  }
  const lease = heartbeatLease(job.lease, { leaseId, workerId: executorId, ttlMinutes, now })
  const at = toIso(now)
  return {
    ...job,
    lease,
    executor: {
      ...job.executor,
      status: job.state === 'VERIFYING' ? 'VERIFYING' : 'RUNNING',
      heartbeatAt: at,
      lastActivityAt: at,
      lastHeadSha: headSha || job.executor.lastHeadSha || null,
      progress: progress ?? job.executor.progress ?? null,
    },
    updatedAt: at,
  }
}

export function executorHandoff(job, {
  executorId,
  leaseId,
  completed = [],
  remaining = [],
  blockers = [],
  headSha = null,
  now = new Date(),
} = {}) {
  validateJob(job)
  if (!job.executor) throw new Error('Job has no attached executor')
  if (job.executor.executorId !== executorId) throw new Error('Executor ID does not match attached executor')
  if (!job.lease || job.lease.leaseId !== leaseId) throw new Error('Lease ID does not match active lease')
  const at = toIso(now)
  return {
    ...job,
    executor: {
      ...job.executor,
      status: 'HANDED_OFF',
      heartbeatAt: at,
      lastActivityAt: at,
      lastHeadSha: headSha || job.executor.lastHeadSha || null,
      handoff: {
        completed: Array.isArray(completed) ? completed : [],
        remaining: Array.isArray(remaining) ? remaining : [],
        blockers: Array.isArray(blockers) ? blockers : [],
        at,
      },
    },
    updatedAt: at,
  }
}

export function executorResult(job, {
  executorId,
  leaseId,
  outcome,
  headSha = null,
  prNumber = null,
  verificationEvidence = [],
  failure = null,
  now = new Date(),
} = {}) {
  validateJob(job)
  if (!job.executor) throw new Error('Job has no attached executor')
  if (job.executor.executorId !== executorId) throw new Error('Executor ID does not match attached executor')
  if (!job.lease || job.lease.leaseId !== leaseId) throw new Error('Lease ID does not match active lease')
  const at = toIso(now)

  if (outcome === 'ready-for-verification') {
    if (job.state !== 'RUNNING' && job.state !== 'REPAIRING') {
      throw new Error(`ready-for-verification requires RUNNING or REPAIRING; found ${job.state}`)
    }
    const prepared = {
      ...job,
      expectedHeadSha: headSha || job.expectedHeadSha,
      prNumber: prNumber ?? job.prNumber,
      executor: {
        ...job.executor,
        status: 'VERIFYING',
        heartbeatAt: at,
        lastActivityAt: at,
        lastHeadSha: headSha || job.executor.lastHeadSha || null,
        verificationEvidence: Array.isArray(verificationEvidence) ? verificationEvidence : [],
      },
    }
    return transitionJob(prepared, 'VERIFYING', { now: at, event: 'executor-ready-for-verification' })
  }

  if (outcome === 'failed') {
    const executor = {
      ...job.executor,
      status: 'FAILED',
      heartbeatAt: at,
      lastActivityAt: at,
      lastHeadSha: headSha || job.executor.lastHeadSha || null,
      failure: failure || 'executor-failed',
    }
    if (!['RUNNING', 'VERIFYING', 'REPAIRING'].includes(job.state)) {
      throw new Error(`failed outcome is invalid in state ${job.state}`)
    }
    const prepared = { ...job, executor, lastFailure: failure || 'executor-failed' }
    return transitionJob(prepared, 'RETRY_WAIT', { now: at, event: 'executor-failed' })
  }

  throw new Error(`Unknown executor outcome: ${outcome}`)
}
