import { randomUUID } from 'node:crypto'

function toDate(value) {
  const date = value instanceof Date ? value : new Date(value)
  if (Number.isNaN(date.getTime())) throw new Error(`Invalid timestamp: ${value}`)
  return date
}

export function createLease({ workerId, workerKind, ttlMinutes = 240, now = new Date(), leaseId = randomUUID() }) {
  if (!workerId) throw new Error('workerId is required')
  if (!workerKind) throw new Error('workerKind is required')
  if (!Number.isFinite(ttlMinutes) || ttlMinutes <= 0) throw new Error('ttlMinutes must be positive')
  const acquired = toDate(now)
  const expires = new Date(acquired.getTime() + ttlMinutes * 60_000)
  return {
    leaseId,
    workerId: String(workerId),
    workerKind: String(workerKind),
    acquiredAt: acquired.toISOString(),
    renewedAt: acquired.toISOString(),
    expiresAt: expires.toISOString(),
  }
}

export function isLeaseExpired(lease, now = new Date()) {
  if (!lease?.expiresAt) return true
  return toDate(now).getTime() >= toDate(lease.expiresAt).getTime()
}

export function assertLeaseOwner(lease, { leaseId, workerId, now = new Date(), allowExpired = false }) {
  if (!lease) throw new Error('No active lease')
  if (lease.leaseId !== leaseId) throw new Error('Lease ID does not match active lease')
  if (lease.workerId !== workerId) throw new Error('Worker ID does not match active lease')
  if (!allowExpired && isLeaseExpired(lease, now)) throw new Error('Lease has expired')
  return true
}

export function heartbeatLease(lease, { leaseId, workerId, ttlMinutes = 240, now = new Date() }) {
  assertLeaseOwner(lease, { leaseId, workerId, now })
  const renewed = toDate(now)
  const expires = new Date(renewed.getTime() + ttlMinutes * 60_000)
  return { ...lease, renewedAt: renewed.toISOString(), expiresAt: expires.toISOString() }
}

export function attachLease(job, lease) {
  if (job?.lease && !isLeaseExpired(job.lease)) throw new Error('Job already has an active lease')
  return { ...job, lease }
}

export function clearLease(job) {
  return { ...job, lease: null }
}

export function recoveryDisposition({ job, hasBranch = false, uniqueCommits = false, openPr = false, deploymentInProgress = false, now = new Date() }) {
  if (!job?.lease || !isLeaseExpired(job.lease, now)) return { action: 'none', reason: 'lease-active-or-missing' }
  if (deploymentInProgress) return { action: 'block-release-reconcile', preserveBranch: true }
  if (openPr) return { action: 'preserve-pr-reconcile', preserveBranch: true }
  if (hasBranch && uniqueCommits) return { action: 'repair-same-branch', preserveBranch: true }
  return { action: 'requeue', preserveBranch: Boolean(hasBranch && uniqueCommits) }
}
