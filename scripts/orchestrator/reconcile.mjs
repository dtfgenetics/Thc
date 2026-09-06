import { isLeaseExpired, recoveryDisposition } from './leases.mjs'

export function classifyReconciliation({ job, branchExists = false, uniqueCommits = 0, openPr = null, mergedPr = null, deploymentInProgress = false, now = new Date() }) {
  if (!job) return { action: branchExists ? 'ORPHAN_BRANCH' : 'NOOP', reason: branchExists ? 'branch-without-job' : 'no-job-no-branch' }

  if (mergedPr) {
    return { action: 'MARK_MERGED', reason: 'merged-pr-found', prNumber: mergedPr.number, mergeSha: mergedPr.merge_commit_sha || mergedPr.mergeSha || null }
  }

  if (openPr) {
    return { action: 'PRESERVE_PR', reason: 'open-pr-found', prNumber: openPr.number, branch: job.branch || null }
  }

  if (!job.lease) {
    if (branchExists && Number(uniqueCommits) > 0) return { action: 'RECOVER_BRANCH', reason: 'unique-work-without-lease', branch: job.branch || null }
    return { action: 'REQUEUE', reason: branchExists ? 'branch-no-active-lease-no-unique-work' : 'missing-lease-and-branch' }
  }

  if (!isLeaseExpired(job.lease, now)) return { action: 'ACTIVE', reason: 'lease-valid', leaseId: job.lease.leaseId }

  const disposition = recoveryDisposition({
    job,
    hasBranch: branchExists,
    uniqueCommits: Number(uniqueCommits) > 0,
    openPr: false,
    deploymentInProgress,
    now,
  })

  if (disposition.action === 'requeue') return { action: 'REQUEUE', reason: 'expired-lease-no-unique-work' }
  if (disposition.action === 'repair-same-branch') return { action: 'RECOVER_BRANCH', reason: 'expired-lease-unique-work', branch: job.branch || null }
  if (disposition.action === 'block-release-reconcile') return { action: 'BLOCK_RELEASE', reason: 'deployment-in-progress', branch: job.branch || null }
  return { action: 'BLOCK', reason: 'expired-lease-ambiguous-state' }
}

export function reconciliationNeedsMutation(result) {
  return !['NOOP', 'ACTIVE'].includes(result?.action)
}
