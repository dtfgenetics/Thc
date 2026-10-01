export function parseManagedBranch(branch) {
  const match = /^(work|project)\/([^/]+)\/(.+)-i(\d+)-([a-f0-9]{7})$/.exec(String(branch || ''))
  if (!match) return null
  return {
    mode: match[1],
    project: match[2],
    task: match[3],
    issueNumber: Number(match[4]),
    digest: match[5],
  }
}

export function classifyJobHealth({ issueNumber, job, branch = null, prs = [], now = new Date() }) {
  const anomalies = []
  const terminal = new Set(['DONE', 'CANCELLED', 'SUPERSEDED'])
  const postMerge = new Set(['MERGED', 'STAGING', 'PRODUCTION_READY', 'DEPLOYING', 'LIVE_VERIFYING', 'DONE'])
  const prStates = new Set(['PR_OPEN', 'INTEGRATION_READY'])
  const activeBranchExpected = !terminal.has(job.state) && !postMerge.has(job.state)

  if (job.branch) {
    const parsed = parseManagedBranch(job.branch)
    if (parsed && parsed.issueNumber !== Number(issueNumber)) {
      anomalies.push({
        code: 'branch-issue-mismatch',
        detail: `branch points to issue ${parsed.issueNumber}, job is issue ${issueNumber}`,
      })
    }
  }

  if (activeBranchExpected && job.branch && !branch?.exists) {
    anomalies.push({ code: 'missing-job-branch', detail: job.branch })
  }

  const related = (prs || []).filter((pr) => pr.headRefName === job.branch)
  const open = related.find((pr) => String(pr.state || '').toUpperCase() === 'OPEN')
  const merged = related.find((pr) => Boolean(pr.mergedAt) || String(pr.state || '').toUpperCase() === 'MERGED')

  if (prStates.has(job.state) && !open) {
    anomalies.push({ code: 'job-pr-missing', detail: `state ${job.state} requires an open PR` })
  }

  if (job.prNumber && related.length > 0 && !related.some((pr) => Number(pr.number) === Number(job.prNumber))) {
    anomalies.push({ code: 'job-pr-number-mismatch', detail: `recorded PR #${job.prNumber} does not match branch PRs` })
  }

  if (open && job.expectedHeadSha && open.headRefOid && job.expectedHeadSha !== open.headRefOid) {
    anomalies.push({
      code: 'stale-expected-head',
      detail: `expected ${job.expectedHeadSha}, current ${open.headRefOid}`,
    })
  }

  if (postMerge.has(job.state) && !merged && job.state !== 'DONE') {
    anomalies.push({ code: 'post-merge-state-without-merged-pr', detail: `state ${job.state} has no merged PR for branch` })
  }

  if (job.lease && terminal.has(job.state)) {
    anomalies.push({ code: 'terminal-job-retains-lease', detail: job.lease.leaseId || 'lease-present' })
  }

  if (['RUNNING', 'VERIFYING', 'REPAIRING'].includes(job.state) && !job.executor) {
    anomalies.push({ code: 'active-job-missing-executor', detail: `state ${job.state} has no executor attachment` })
  }

  if (job.executor && job.lease && job.executor.executorId !== job.lease.workerId) {
    anomalies.push({
      code: 'executor-lease-owner-mismatch',
      detail: `executor ${job.executor.executorId || 'unknown'} != lease worker ${job.lease.workerId || 'unknown'}`,
    })
  }

  if (job.executor?.heartbeatAt && ['RUNNING', 'VERIFYING', 'REPAIRING'].includes(job.state)) {
    const heartbeat = new Date(job.executor.heartbeatAt).getTime()
    const current = now instanceof Date ? now.getTime() : new Date(now).getTime()
    if (Number.isFinite(heartbeat) && Number.isFinite(current) && current - heartbeat > 60 * 60 * 1000) {
      anomalies.push({
        code: 'executor-heartbeat-stale',
        detail: `last heartbeat ${job.executor.heartbeatAt}`,
      })
    }
  }

  return anomalies
}

export function findOrphanManagedBranches(branches = [], jobsByIssue = new Map()) {
  const orphans = []
  for (const branch of branches) {
    const parsed = parseManagedBranch(branch.name)
    if (!parsed) continue
    const job = jobsByIssue.get(parsed.issueNumber)
    if (!job) {
      orphans.push({
        code: 'orphan-managed-branch',
        branch: branch.name,
        headSha: branch.headSha || null,
        issueNumber: parsed.issueNumber,
      })
      continue
    }
    if (job.branch && job.branch !== branch.name) {
      orphans.push({
        code: 'superseded-managed-branch',
        branch: branch.name,
        headSha: branch.headSha || null,
        issueNumber: parsed.issueNumber,
        recordedBranch: job.branch,
      })
    }
  }
  return orphans
}

export function findOrphanManagedPrs(prs = [], jobsByIssue = new Map()) {
  const orphans = []
  for (const pr of prs) {
    const parsed = parseManagedBranch(pr.headRefName)
    if (!parsed) continue
    const job = jobsByIssue.get(parsed.issueNumber)
    if (!job) {
      orphans.push({
        code: 'orphan-managed-pr',
        prNumber: Number(pr.number),
        branch: pr.headRefName,
        headSha: pr.headRefOid || null,
        issueNumber: parsed.issueNumber,
        state: pr.state || null,
      })
      continue
    }
    if (job.branch && job.branch !== pr.headRefName) {
      orphans.push({
        code: 'pr-branch-not-current-job-branch',
        prNumber: Number(pr.number),
        branch: pr.headRefName,
        headSha: pr.headRefOid || null,
        issueNumber: parsed.issueNumber,
        recordedBranch: job.branch,
        state: pr.state || null,
      })
    }
  }
  return orphans
}

export function findDuplicateActiveResourceClaims(jobsByIssue = new Map()) {
  const terminal = new Set(['DONE', 'CANCELLED', 'SUPERSEDED'])
  const owners = new Map()
  for (const [issueNumber, job] of jobsByIssue.entries()) {
    if (terminal.has(job?.state)) continue
    for (const resource of job?.resourceSet || []) {
      if (!owners.has(resource)) owners.set(resource, [])
      owners.get(resource).push({
        issueNumber: Number(issueNumber),
        jobId: job.jobId || null,
        state: job.state || null,
        branch: job.branch || null,
      })
    }
  }
  return [...owners.entries()]
    .filter(([, claims]) => claims.length > 1)
    .map(([resource, claims]) => ({
      code: 'duplicate-active-resource-claim',
      resource,
      claims,
    }))
}
