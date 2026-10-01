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

export function classifyJobHealth({ issueNumber, job, branch = null, prs = [] }) {
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
