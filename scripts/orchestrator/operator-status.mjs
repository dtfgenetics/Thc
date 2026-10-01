function cleanArray(value) {
  return Array.isArray(value) ? value.filter(Boolean) : []
}

export function buildOperatorStatus({
  activeClaims = [],
  readyIssues = [],
  plannedClaims = [],
  dependencyBlocked = [],
} = {}) {
  const active = activeClaims.map((claim) => ({
    issueNumber: claim.issueNumber ?? claim.issueId ?? null,
    jobId: claim.jobId || null,
    title: claim.title || null,
    state: claim.state || (claim.active === false ? 'STALE' : 'CLAIMED'),
    project: claim.project || 'general',
    repository: claim.repository || null,
    branch: claim.branch || null,
    expectedHeadSha: claim.expectedHeadSha || null,
    prNumber: claim.prNumber ?? null,
    resources: cleanArray(claim.resourceSet),
    productionTargets: cleanArray(claim.productionTargets),
    executor: claim.executor ? {
      id: claim.executor.executorId || null,
      provider: claim.executor.provider || null,
      status: claim.executor.status || null,
      heartbeatAt: claim.executor.heartbeatAt || null,
      lastHeadSha: claim.executor.lastHeadSha || null,
    } : null,
    handoff: claim.executor?.handoff ? {
      completed: cleanArray(claim.executor.handoff.completed),
      remaining: cleanArray(claim.executor.handoff.remaining),
      blockers: cleanArray(claim.executor.handoff.blockers),
      at: claim.executor.handoff.at || null,
    } : null,
    lease: claim.lease ? {
      id: claim.lease.leaseId || null,
      workerId: claim.lease.workerId || null,
      expiresAt: claim.lease.expiresAt || null,
      expired: Boolean(claim.expired),
    } : null,
    malformed: Boolean(claim.malformed),
  }))

  const resourceClaims = {}
  for (const job of active) {
    for (const resource of job.resources) {
      if (!resourceClaims[resource]) resourceClaims[resource] = []
      resourceClaims[resource].push({
        issueNumber: job.issueNumber,
        project: job.project,
        branch: job.branch,
        state: job.state,
      })
    }
  }

  const blockers = []
  for (const job of active) {
    if (job.malformed) blockers.push({ type: 'malformed-job-marker', issueNumber: job.issueNumber })
    if (job.lease?.expired) blockers.push({ type: 'expired-lease', issueNumber: job.issueNumber, branch: job.branch })
    for (const blocker of job.handoff?.blockers || []) {
      blockers.push({ type: 'handoff-blocker', issueNumber: job.issueNumber, detail: blocker })
    }
  }
  for (const blocked of dependencyBlocked) {
    blockers.push({
      type: 'dependency-blocker',
      issueNumber: blocked.issueNumber,
      dependencies: cleanArray(blocked.blockers),
    })
  }

  return {
    summary: {
      activeJobs: active.filter((job) => !job.lease?.expired).length,
      expiredJobs: active.filter((job) => job.lease?.expired).length,
      readyJobs: readyIssues.length,
      plannedJobs: plannedClaims.length,
      claimedResources: Object.keys(resourceClaims).length,
      blockers: blockers.length,
      handedOffJobs: active.filter((job) => job.handoff).length,
    },
    activeJobs: active,
    plannedJobs: plannedClaims.map((claim) => ({
      issueNumber: claim.issueNumber ?? null,
      project: claim.project || 'general',
      repository: claim.repository || null,
      branch: claim.branch || null,
      resources: cleanArray(claim.resourceSet),
      verificationProfile: claim.verificationProfile || null,
      productionTargets: cleanArray(claim.productionTargets),
    })),
    resourceClaims,
    blockers,
  }
}
