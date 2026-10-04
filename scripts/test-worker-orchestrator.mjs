#!/usr/bin/env node

import assert from 'node:assert/strict'
import fs from 'node:fs'
import { buildClaim, claimReadiness, dependenciesSatisfied, dependencyBlockers, dependencyIssueNumber, isReady, planClaims, planMetadataFromIssue, priorityRank, resourceSetsOverlap, validateConfig } from './orchestrator/core.mjs'
import { newJob, transitionJob, canTransition } from './orchestrator/state.mjs'
import { createLease, heartbeatLease, isLeaseExpired, recoveryDisposition } from './orchestrator/leases.mjs'
import { classifyReconciliation, reconciliationNeedsMutation } from './orchestrator/reconcile.mjs'
import { exactHeadMatches, inspectAllowedPaths, inspectCheckRollup, isPathAllowed, normalizeCheck } from './orchestrator/verification.mjs'
import { classifyJobHealth, findDuplicateActiveResourceClaims, findOrphanManagedBranches, findOrphanManagedPrs, parseManagedBranch } from './orchestrator/audit.mjs'
import { buildExecutionPacket, buildHandoffPacket, claimExecutor, executorHandoff, executorResult, heartbeatExecutor, renderHandoffMarkdown } from './orchestrator/executor.mjs'
import { resolveCanonicalRepository } from './orchestrator/repositories.mjs'
import { epicSummary, materializeJobPlan, topologicalJobOrder, validateEpicManifest } from './orchestrator/epics.mjs'
import { inspectContractScope, validateAgentContract, verificationProfileFromContract } from './orchestrator/repo-contract.mjs'
import { inspectAcceptanceContract, normalizeAcceptanceCriterion } from './orchestrator/acceptance.mjs'
import { classifyVerificationFailure } from './orchestrator/verification.mjs'
import { applyRepairPlan, planRepair } from './orchestrator/repair.mjs'
import { recordDeploymentComplete, recordLiveVerification, startProductionRelease } from './orchestrator/release.mjs'
import { executorDemand, executorQueue } from './orchestrator/executor-pool.mjs'
import { buildOperatorStatus } from './orchestrator/operator-status.mjs'

const config = validateConfig({
  version: 2,
  baseBranch: 'main',
  maxWorkers: 3,
  maxWorkersPerProject: 1,
  maxScopedWorkersPerProject: 2,
  lease: { ttlMinutes: 240, heartbeatGraceMinutes: 15, maxAttempts: 3 },
  labels: {
    ready: 'worker:ready',
    claimed: 'worker:claimed',
    running: 'worker:running',
    verifying: 'worker:verifying',
    retry: 'worker:retry',
    stale: 'worker:stale',
    blocked: 'worker:blocked',
    failed: 'worker:failed',
    quarantined: 'worker:quarantined',
    integrationReady: 'worker:integration-ready',
    done: 'worker:done',
  },
  priorities: ['priority:p0', 'priority:p1', 'priority:p2'],
  workerKinds: {
    code: { label: 'worker:code', branchPrefix: 'work' },
    audit: { label: 'worker:audit', branchPrefix: 'work' },
    release: { label: 'worker:release', branchPrefix: 'project' },
  },
})

const issue = (number, title, labels, createdAt = '2026-09-06T12:00:00Z') => ({
  number,
  title,
  labels: labels.map((name) => ({ name })),
  state: 'open',
  created_at: createdAt,
  body: '',
})

assert.equal(isReady(issue(1, 'Ready', ['worker:ready']), config), true)
assert.equal(isReady(issue(2, 'Claimed', ['worker:ready', 'worker:claimed']), config), false)
assert.equal(isReady(issue(3, 'Blocked', ['worker:ready', 'worker:blocked']), config), false)
assert.equal(isReady(issue(31, 'Running', ['worker:ready', 'worker:running']), config), false)

const claim = buildClaim(issue(4, 'Fix broken game shell', ['worker:ready', 'worker:audit', 'project:games']), config)
assert.equal(claim.project, 'games')
assert.equal(claim.kind, 'audit')
assert.match(claim.branch, /^work\/games\/fix-broken-game-shell-i4-[a-f0-9]{7}$/)

const plannedIssue = {
  ...issue(5, 'Scoped game job', ['worker:ready', 'project:games']),
  body: '<!-- worker-plan:{"resourceSet":["game.high-iq"],"allowedPaths":["games/high-iq/**","site/public-route-patch/games/high-iq/**"],"verificationProfile":"high-iq","productionTargets":["route:/games/high-iq/"],"dependencies":["issue-1"],"acceptanceCriteria":["mobile works"],"productionImpact":true} -->',
}
const metadata = planMetadataFromIssue(plannedIssue)
assert.deepEqual(metadata.resourceSet, ['game.high-iq'])
assert.deepEqual(metadata.allowedPaths, ['games/high-iq/**', 'site/public-route-patch/games/high-iq/**'])
assert.equal(metadata.verificationProfile, 'high-iq')
assert.equal(metadata.productionImpact, true)
assert.equal(resourceSetsOverlap(['game.high-iq'], ['game.high-iq']), true)
assert.equal(resourceSetsOverlap(['game.high-iq'], ['app.plant-atlas']), false)


const toolsOwner = resolveCanonicalRepository({ canonicalDomain: 'cultivation tools' })
assert.equal(toolsOwner.repository, 'dtfgenetics/Tools')
assert.equal(toolsOwner.external, true)
assert.throws(
  () => resolveCanonicalRepository({ canonicalDomain: 'cultivation tools', explicitRepository: 'dtfgenetics/Dtf420' }),
  /not canonical/,
)

const externalToolsIssue = {
  ...issue(40, 'Improve canonical VPD tool', ['worker:ready', 'project:tools']),
  body: '<!-- worker-plan:{"canonicalDomain":"cultivation tools","resourceSet":["tool.vpd"],"allowedPaths":["site/public-route-patch/tools/vpd/**"],"verificationProfile":"default","acceptanceCriteria":["tool tests pass"]} -->',
}
const externalToolsClaim = buildClaim(externalToolsIssue, config)
assert.equal(externalToolsClaim.repository, 'dtfgenetics/Tools')
assert.equal(externalToolsClaim.externalRepository, true)
assert.equal(externalToolsClaim.dispatchMode, 'external-executor')
assert.equal(externalToolsClaim.dispatchable, false)
assert.deepEqual(externalToolsClaim.allowedPaths, ['site/public-route-patch/tools/vpd/**'])
assert.throws(
  () => buildClaim({
    ...issue(41, 'Unsafe external job', ['worker:ready', 'project:tools']),
    body: '<!-- worker-plan:{"canonicalDomain":"cultivation tools","resourceSet":["tool.vpd"],"verificationProfile":"default"} -->',
  }, config),
  /requires explicit allowedPaths/,
)


const scopedClaim = buildClaim(plannedIssue, config)
assert.deepEqual(scopedClaim.resourceSet, ['game.high-iq'])
assert.equal(scopedClaim.verificationProfile, 'high-iq')


const planned = planClaims([
  issue(10, 'P2 games', ['worker:ready', 'priority:p2', 'project:games']),
  issue(11, 'P0 games', ['worker:ready', 'priority:p0', 'project:games']),
  issue(12, 'P1 education', ['worker:ready', 'priority:p1', 'project:education']),
  issue(13, 'P0 release', ['worker:ready', 'priority:p0', 'worker:release', 'project:release']),
  issue(14, 'P0 atlas', ['worker:ready', 'priority:p0', 'project:atlas']),
], [
  { issueNumber: 99, project: 'atlas', active: true },
], config)

assert.equal(planned.length, 2, 'one existing worker leaves two available slots')
assert.deepEqual(planned.map((item) => item.issueNumber), [11, 13], 'priority and per-project limits should control allocation')
assert.equal(planned[1].branch.startsWith('project/release/'), true)

const duplicateProjectPlan = planClaims([
  issue(20, 'First', ['worker:ready', 'priority:p0', 'project:games']),
  issue(21, 'Second', ['worker:ready', 'priority:p0', 'project:games'], '2026-09-06T12:01:00Z'),
], [], config)
assert.equal(duplicateProjectPlan.length, 1, 'only one worker may claim a project when maxWorkersPerProject=1')
assert.equal(duplicateProjectPlan[0].issueNumber, 20)


const sameProjectScopedPlan = planClaims([
  {
    ...issue(30, 'High IQ scoped', ['worker:ready', 'project:games']),
    body: '<!-- worker-plan:{"resourceSet":["game.high-iq"]} -->',
  },
  {
    ...issue(32, 'Plant Atlas scoped', ['worker:ready', 'project:games']),
    body: '<!-- worker-plan:{"resourceSet":["app.plant-atlas"]} -->',
  },
], [], config)
assert.deepEqual(
  sameProjectScopedPlan.map((item) => item.issueNumber),
  [30, 32],
  'disjoint scoped resources may run concurrently inside one project',
)

const unscopedBlocksScopedPlan = planClaims([
  {
    ...issue(33, 'High IQ waits', ['worker:ready', 'project:games']),
    body: '<!-- worker-plan:{"resourceSet":["game.high-iq"]} -->',
  },
], [
  { issueNumber: 98, project: 'games', active: true, resourceSet: [] },
], config)
assert.deepEqual(unscopedBlocksScopedPlan, [], 'legacy unscoped project work must keep the project exclusive')

const scopedProjectLimitPlan = planClaims([
  {
    ...issue(34, 'Scoped one', ['worker:ready', 'project:games']),
    body: '<!-- worker-plan:{"resourceSet":["game.high-iq"]} -->',
  },
  {
    ...issue(35, 'Scoped two', ['worker:ready', 'project:games']),
    body: '<!-- worker-plan:{"resourceSet":["game.high-land"]} -->',
  },
  {
    ...issue(36, 'Scoped three', ['worker:ready', 'project:games']),
    body: '<!-- worker-plan:{"resourceSet":["app.plant-atlas"]} -->',
  },
], [], config)
assert.equal(scopedProjectLimitPlan.length, 2, 'scoped same-project concurrency must respect maxScopedWorkersPerProject')


assert.equal(dependencyIssueNumber('issue-123'), 123)
assert.equal(dependencyIssueNumber('#123'), 123)
assert.equal(dependencyIssueNumber('bad'), null)
assert.equal(dependenciesSatisfied(['issue-1'], []), false)
assert.equal(dependenciesSatisfied(['issue-1'], ['1']), true)
assert.deepEqual(dependencyBlockers(['issue-1', 'issue-2'], ['1']), ['issue-2'])

const blockedDependencyPlan = planClaims([plannedIssue], [], config, [])
assert.deepEqual(blockedDependencyPlan, [], 'jobs must wait for incomplete dependencies')
const releasedDependencyPlan = planClaims([plannedIssue], [], config, ['1'])
assert.deepEqual(releasedDependencyPlan.map((item) => item.issueNumber), [5], 'completed dependencies must release jobs')

const autoProfileIssue = {
  ...issue(8, 'Auto-routed game', ['worker:ready', 'project:auto']),
  body: '<!-- worker-plan:{"resourceSet":["game.high-iq"]} -->',
}
assert.equal(buildClaim(autoProfileIssue, config).verificationProfile, 'high-iq')
const genericGameProfileIssue = {
  ...issue(9, 'Generic game route', ['worker:ready', 'project:auto2']),
  body: '<!-- worker-plan:{"resourceSet":["game.some-new-game"]} -->',
}
assert.equal(buildClaim(genericGameProfileIssue, config).verificationProfile, 'games-general')
const atlasProfileIssue = {
  ...issue(15, 'Atlas route', ['worker:ready', 'project:auto3']),
  body: '<!-- worker-plan:{"resourceSet":["app.plant-atlas"]} -->',
}
assert.equal(buildClaim(atlasProfileIssue, config).verificationProfile, 'repo-control')
const conflictingProfilesIssue = {
  ...issue(16, 'Mixed profiles', ['worker:ready', 'project:auto4']),
  body: '<!-- worker-plan:{"resourceSet":["game.high-iq","content.education"]} -->',
}
assert.throws(() => buildClaim(conflictingProfilesIssue, config), /multiple verification profiles/)

const resourceConflictPlan = planClaims([
  plannedIssue,
  {
    ...issue(6, 'Second scoped game job', ['worker:ready', 'project:other']),
    body: '<!-- worker-plan:{"resourceSet":["game.high-iq"],"allowedPaths":["games/high-iq/**"]} -->',
  },
  {
    ...issue(7, 'Independent scoped job', ['worker:ready', 'project:third']),
    body: '<!-- worker-plan:{"resourceSet":["app.plant-atlas"],"allowedPaths":["site/public-route-patch/atlas/**"]} -->',
  },
], [
  { issueNumber: 90, project: 'active-other', active: true, resourceSet: ['content.education'] },
], config, ['1'])
assert.deepEqual(resourceConflictPlan.map((item) => item.issueNumber), [5, 7], 'duplicate resource claims must not be planned together')


const job = newJob({ jobId: 'job-1', title: 'Lifecycle test', state: 'READY', project: 'games', productionImpact: false }, { now: '2026-09-06T12:00:00.000Z' })
assert.equal(canTransition('READY', 'LEASED'), true)
assert.equal(canTransition('READY', 'DONE'), false)
const leasedJob = transitionJob(job, 'LEASED', { now: '2026-09-06T12:01:00.000Z' })
assert.equal(leasedJob.state, 'LEASED')
assert.throws(() => transitionJob(job, 'DONE'), /Invalid orchestrator transition/)

const lease = createLease({ workerId: 'worker-a', workerKind: 'code', ttlMinutes: 10, now: '2026-09-06T12:00:00.000Z', leaseId: 'lease-1' })
assert.equal(isLeaseExpired(lease, '2026-09-06T12:09:59.000Z'), false)
assert.equal(isLeaseExpired(lease, '2026-09-06T12:10:00.000Z'), true)
const renewed = heartbeatLease(lease, { leaseId: 'lease-1', workerId: 'worker-a', ttlMinutes: 10, now: '2026-09-06T12:05:00.000Z' })
assert.equal(renewed.expiresAt, '2026-09-06T12:15:00.000Z')
assert.throws(() => heartbeatLease(lease, { leaseId: 'wrong', workerId: 'worker-a', now: '2026-09-06T12:05:00.000Z' }), /Lease ID/)
assert.throws(() => heartbeatLease(lease, { leaseId: 'lease-1', workerId: 'worker-b', now: '2026-09-06T12:05:00.000Z' }), /Worker ID/)

const expiredJob = { ...leasedJob, branch: 'work/games/example', lease }
assert.deepEqual(
  recoveryDisposition({ job: expiredJob, hasBranch: false, uniqueCommits: false, openPr: false, now: '2026-09-06T12:11:00.000Z' }),
  { action: 'requeue', preserveBranch: false },
)
assert.deepEqual(
  recoveryDisposition({ job: expiredJob, hasBranch: true, uniqueCommits: true, openPr: false, now: '2026-09-06T12:11:00.000Z' }),
  { action: 'repair-same-branch', preserveBranch: true },
)
assert.deepEqual(
  recoveryDisposition({ job: expiredJob, hasBranch: true, uniqueCommits: true, openPr: true, now: '2026-09-06T12:11:00.000Z' }),
  { action: 'preserve-pr-reconcile', preserveBranch: true },
)

assert.equal(classifyReconciliation({ job: expiredJob, branchExists: false, uniqueCommits: 0, now: '2026-09-06T12:11:00.000Z' }).action, 'REQUEUE')
assert.equal(classifyReconciliation({ job: expiredJob, branchExists: true, uniqueCommits: 2, now: '2026-09-06T12:11:00.000Z' }).action, 'RECOVER_BRANCH')
assert.equal(classifyReconciliation({ job: expiredJob, branchExists: true, uniqueCommits: 2, openPr: { number: 77 }, now: '2026-09-06T12:11:00.000Z' }).action, 'PRESERVE_PR')
assert.equal(classifyReconciliation({ job: expiredJob, branchExists: true, mergedPr: { number: 78, merge_commit_sha: 'abc123' }, now: '2026-09-06T12:11:00.000Z' }).action, 'MARK_MERGED')
assert.equal(classifyReconciliation({ job: null, branchExists: true }).action, 'ORPHAN_BRANCH')
assert.equal(reconciliationNeedsMutation({ action: 'ACTIVE' }), false)
assert.equal(reconciliationNeedsMutation({ action: 'RECOVER_BRANCH' }), true)

assert.deepEqual(normalizeCheck({ name: 'build', status: 'COMPLETED', conclusion: 'SUCCESS' }), {
  name: 'build', status: 'COMPLETED', conclusion: 'SUCCESS', completed: true,
})
assert.equal(inspectCheckRollup([]).reason, 'no-checks-reported')
assert.equal(inspectCheckRollup([{ name: 'build', status: 'IN_PROGRESS', conclusion: '' }]).reason, 'checks-pending')
assert.equal(inspectCheckRollup([{ name: 'build', status: 'COMPLETED', conclusion: 'FAILURE' }]).reason, 'checks-failing')
assert.equal(inspectCheckRollup([{ name: 'build', status: 'COMPLETED', conclusion: 'SUCCESS' }]).ok, true)
assert.equal(exactHeadMatches('abc', 'abc', true), true)
assert.equal(exactHeadMatches('abc', 'def', true), false)
assert.equal(exactHeadMatches(null, 'def', true), true)


assert.equal(isPathAllowed('games/high-iq/index.js', ['games/high-iq/**']), true)
assert.equal(isPathAllowed('games/high-land/index.js', ['games/high-iq/**']), false)
assert.equal(isPathAllowed('data/public-navigation.json', ['data/public-navigation.json']), true)
assert.equal(inspectAllowedPaths(['games/high-iq/index.js'], ['games/high-iq/**']).ok, true)
const pathViolation = inspectAllowedPaths(
  ['games/high-iq/index.js', 'data/public-navigation.json'],
  ['games/high-iq/**'],
)
assert.equal(pathViolation.ok, false)
assert.deepEqual(pathViolation.violations, ['data/public-navigation.json'])



const parsedManaged = parseManagedBranch('work/games/fix-mobile-i123-abcdef0')
assert.equal(parsedManaged.issueNumber, 123)
assert.equal(parseManagedBranch('project/platform/manual-branch'), null)

const healthyAuditJob = {
  ...newJob({ jobId: 'issue-123', issueId: 123, title: 'Audit job', state: 'RUNNING', branch: 'work/games/fix-mobile-i123-abcdef0' }),
  lease: { leaseId: 'lease-a', workerId: 'executor-a' },
  executor: { executorId: 'executor-a', heartbeatAt: '2026-09-06T12:00:00.000Z', status: 'RUNNING' },
}
assert.deepEqual(classifyJobHealth({
  issueNumber: 123,
  job: healthyAuditJob,
  branch: { exists: true, name: healthyAuditJob.branch, headSha: 'abc' },
  prs: [],
  now: '2026-09-06T12:30:00.000Z',
}), [])


const missingExecutorHealth = classifyJobHealth({
  issueNumber: 125,
  job: { ...newJob({ jobId: 'issue-125', issueId: 125, title: 'Missing executor', state: 'RUNNING', branch: 'work/test/missing-exec-i125-abcdef4' }), lease: { leaseId: 'lease-b', workerId: 'dispatcher' } },
  branch: { exists: true, name: 'work/test/missing-exec-i125-abcdef4' },
  prs: [],
  now: '2026-09-06T12:30:00.000Z',
})
assert.equal(missingExecutorHealth.some((item) => item.code === 'active-job-missing-executor'), true)

const staleExecutorHealth = classifyJobHealth({
  issueNumber: 126,
  job: {
    ...newJob({ jobId: 'issue-126', issueId: 126, title: 'Stale executor', state: 'RUNNING', branch: 'work/test/stale-exec-i126-abcdef5' }),
    lease: { leaseId: 'lease-c', workerId: 'executor-c' },
    executor: { executorId: 'executor-c', heartbeatAt: '2026-09-06T10:00:00.000Z', status: 'RUNNING' },
  },
  branch: { exists: true, name: 'work/test/stale-exec-i126-abcdef5' },
  prs: [],
  now: '2026-09-06T12:30:00.000Z',
})
assert.equal(staleExecutorHealth.some((item) => item.code === 'executor-heartbeat-stale'), true)

const missingBranchHealth = classifyJobHealth({
  issueNumber: 123,
  job: healthyAuditJob,
  branch: { exists: false, name: healthyAuditJob.branch },
  prs: [],
})
assert.equal(missingBranchHealth.some((item) => item.code === 'missing-job-branch'), true)

const prAuditJob = newJob({
  jobId: 'issue-124',
  issueId: 124,
  title: 'PR audit',
  state: 'PR_OPEN',
  branch: 'work/games/pr-audit-i124-abcdef1',
  prNumber: 50,
  expectedHeadSha: 'old',
})
const prHealth = classifyJobHealth({
  issueNumber: 124,
  job: prAuditJob,
  branch: { exists: true, name: prAuditJob.branch, headSha: 'new' },
  prs: [{ number: 50, state: 'OPEN', headRefName: prAuditJob.branch, headRefOid: 'new' }],
})
assert.equal(prHealth.some((item) => item.code === 'stale-expected-head'), true)

const orphanBranches = findOrphanManagedBranches([
  { name: 'work/games/orphan-i200-abcdef2', headSha: 'sha200' },
  { name: healthyAuditJob.branch, headSha: 'abc' },
], new Map([[123, healthyAuditJob]]))
assert.deepEqual(orphanBranches.map((item) => item.issueNumber), [200])

const orphanPrs = findOrphanManagedPrs([
  { number: 88, state: 'OPEN', headRefName: 'work/games/orphan-i200-abcdef2', headRefOid: 'sha200' },
  { number: 89, state: 'OPEN', headRefName: healthyAuditJob.branch, headRefOid: 'abc' },
], new Map([[123, healthyAuditJob]]))
assert.deepEqual(orphanPrs.map((item) => item.prNumber), [88])

const duplicateClaims = findDuplicateActiveResourceClaims(new Map([
  [123, { ...healthyAuditJob, resourceSet: ['game.high-iq'] }],
  [124, { ...prAuditJob, resourceSet: ['game.high-iq'] }],
  [125, { ...healthyAuditJob, state: 'DONE', resourceSet: ['game.high-iq'] }],
]))
assert.equal(duplicateClaims.length, 1)
assert.equal(duplicateClaims[0].resource, 'game.high-iq')
assert.deepEqual(duplicateClaims[0].claims.map((item) => item.issueNumber), [123, 124])



const externalExecutorSourceJob = {
  ...newJob({
    jobId: 'issue-399',
    issueId: 399,
    title: 'External executor test',
    state: 'LEASED',
    project: 'tools',
    repository: 'dtfgenetics/Tools',
    canonicalDomain: 'cultivation tools',
    dispatchMode: 'external-executor',
    branchProvisioned: false,
    workerKind: 'code',
    branch: 'work/tools/external-i399-abcdef6',
    allowedPaths: ['site/public-route-patch/tools/vpd/**'],
    verificationProfile: 'default',
  }),
  lease: createLease({ workerId: 'dispatcher', workerKind: 'code', ttlMinutes: 60, leaseId: 'lease-external' }),
}
assert.throws(
  () => claimExecutor(externalExecutorSourceJob, { executorId: 'chat:external', ttlMinutes: 60 }),
  /branch to be provisioned/,
)
assert.equal(buildExecutionPacket(externalExecutorSourceJob).branchProvisioned, false)

const executorSourceJob = {
  ...newJob({
    jobId: 'issue-300',
    issueId: 300,
    title: 'Executor protocol test',
    state: 'LEASED',
    project: 'games',
    repository: 'dtfgenetics/Thc',
    workerKind: 'game',
    branch: 'work/games/executor-protocol-i300-abcdef3',
    baseBranch: 'main',
    baseSha: 'base300',
    resourceSet: ['game.high-iq'],
    allowedPaths: ['games/high-iq/**'],
    verificationProfile: 'high-iq',
    acceptanceCriteria: ['tests pass'],
  }, { now: '2026-09-30T21:00:00.000Z' }),
  lease: createLease({
    workerId: 'github-run:1',
    workerKind: 'game',
    ttlMinutes: 60,
    now: '2026-09-30T21:00:00.000Z',
    leaseId: 'lease-exec-1',
  }),
}
const packet = buildExecutionPacket(executorSourceJob, { issueNumber: 300 })
assert.equal(packet.worker.kind, 'game')
assert.equal(packet.branch.name, executorSourceJob.branch)
assert.deepEqual(packet.scope.resources, ['game.high-iq'])

const claimedExecutorJob = claimExecutor(executorSourceJob, {
  executorId: 'chat:abc',
  provider: 'chatgpt',
  sessionId: 'session-1',
  ttlMinutes: 60,
  now: '2026-09-30T21:05:00.000Z',
})
assert.equal(claimedExecutorJob.state, 'RUNNING')
assert.equal(claimedExecutorJob.lease.workerId, 'chat:abc')
assert.equal(claimedExecutorJob.executor.executorId, 'chat:abc')

const heartbeatExecutorJob = heartbeatExecutor(claimedExecutorJob, {
  executorId: 'chat:abc',
  leaseId: 'lease-exec-1',
  ttlMinutes: 60,
  progress: 'editing',
  headSha: 'head300a',
  now: '2026-09-30T21:10:00.000Z',
})
assert.equal(heartbeatExecutorJob.executor.progress, 'editing')
assert.equal(heartbeatExecutorJob.executor.lastHeadSha, 'head300a')

const handoffExecutorJob = executorHandoff(heartbeatExecutorJob, {
  executorId: 'chat:abc',
  leaseId: 'lease-exec-1',
  completed: ['implementation'],
  remaining: ['verification'],
  blockers: [],
  headSha: 'head300b',
  now: '2026-09-30T21:15:00.000Z',
})
assert.equal(handoffExecutorJob.executor.status, 'HANDED_OFF')
assert.deepEqual(handoffExecutorJob.executor.handoff.remaining, ['verification'])
const durableHandoff = buildHandoffPacket(handoffExecutorJob, { issueNumber: 300 })
assert.equal(durableHandoff.ownership.repository, 'dtfgenetics/Thc')
assert.deepEqual(durableHandoff.ownership.resources, ['game.high-iq'])
assert.equal(durableHandoff.branch.currentHeadSha, 'head300b')
assert.deepEqual(durableHandoff.progress.completed, ['implementation'])
assert.deepEqual(durableHandoff.progress.remaining, ['verification'])
assert.equal(durableHandoff.production.liveVerificationRequired, false)
const durableHandoffMarkdown = renderHandoffMarkdown(handoffExecutorJob, { issueNumber: 300 })
assert.match(durableHandoffMarkdown, /Durable chat\/agent handoff/)
assert.match(durableHandoffMarkdown, /Canonical repository: `dtfgenetics\/Thc`/)
assert.match(durableHandoffMarkdown, /Current head SHA: `head300b`/)
assert.match(durableHandoffMarkdown, /verification/)

const operatorStatus = buildOperatorStatus({
  activeClaims: [
    { issueNumber: 300, ...handoffExecutorJob, active: true, expired: false },
    { issueNumber: 301, project: 'tools', state: 'LEASED', resourceSet: ['tool.vpd'], branch: 'work/tools/vpd-i301-abcdef7', active: false, expired: true, lease: { leaseId: 'lease-expired', workerId: 'chat:x', expiresAt: '2026-09-30T20:00:00.000Z' } },
  ],
  readyIssues: [issue(302, 'Ready job', ['worker:ready'])],
  plannedClaims: [{ issueNumber: 302, project: 'education', repository: 'dtfgenetics/thc-grow-hub', branch: 'work/education/next-i302-abcdef8', resourceSet: ['content.education'], verificationProfile: 'repo-control' }],
  dependencyBlocked: [{ issueNumber: 303, blockers: ['issue-299'] }],
})
assert.equal(operatorStatus.summary.activeJobs, 1)
assert.equal(operatorStatus.summary.expiredJobs, 1)
assert.equal(operatorStatus.summary.handedOffJobs, 1)
assert.equal(operatorStatus.resourceClaims['game.high-iq'][0].issueNumber, 300)
assert.equal(operatorStatus.blockers.some((item) => item.type === 'expired-lease' && item.issueNumber === 301), true)
assert.equal(operatorStatus.blockers.some((item) => item.type === 'dependency-blocker' && item.issueNumber === 303), true)

const verifyReadyJob = executorResult(heartbeatExecutorJob, {
  executorId: 'chat:abc',
  leaseId: 'lease-exec-1',
  outcome: 'ready-for-verification',
  headSha: 'head300c',
  prNumber: 77,
  verificationEvidence: ['npm test'],
  now: '2026-09-30T21:20:00.000Z',
})
assert.equal(verifyReadyJob.state, 'VERIFYING')
assert.equal(verifyReadyJob.expectedHeadSha, 'head300c')
assert.equal(verifyReadyJob.prNumber, 77)

const failedExecutorJob = executorResult(heartbeatExecutorJob, {
  executorId: 'chat:abc',
  leaseId: 'lease-exec-1',
  outcome: 'failed',
  failure: 'test-failure',
  now: '2026-09-30T21:20:00.000Z',
})
assert.equal(failedExecutorJob.state, 'RETRY_WAIT')
assert.equal(failedExecutorJob.executor.status, 'FAILED')


const epicManifest = validateEpicManifest({
  schemaVersion: 1,
  epic: {
    title: 'Tools modernization',
    goal: 'Modernize two independent tools after shared infrastructure lands.',
    project: 'tools',
    system: 'Cultivation Tools',
  },
  jobs: [
    {
      key: 'shared-shell',
      title: 'Build shared tool shell',
      goal: 'Create the shared shell.',
      workerKind: 'code',
      resourceSet: ['platform.site-shell'],
      acceptanceCriteria: ['shared shell tests pass'],
    },
    {
      key: 'vpd',
      title: 'Migrate VPD',
      goal: 'Move VPD to the shared shell.',
      workerKind: 'code',
      resourceSet: ['app.growlens'],
      dependencies: ['shared-shell'],
      acceptanceCriteria: ['VPD flow passes'],
    },
  ],
})
assert.deepEqual(topologicalJobOrder(epicManifest).map((job) => job.key), ['shared-shell', 'vpd'])
assert.deepEqual(epicSummary(epicManifest).jobs.map((job) => job.key), ['shared-shell', 'vpd'])
const issueMap = new Map([['shared-shell', 501]])
const materializedVpd = materializeJobPlan(epicManifest.jobs[1], issueMap)
assert.deepEqual(materializedVpd.dependencies, ['issue-501'])
assert.throws(() => validateEpicManifest({
  schemaVersion: 1,
  epic: { title: 'Cycle', goal: 'Detect cycle', project: 'test' },
  jobs: [
    { key: 'a', title: 'A', goal: 'A', workerKind: 'code', resourceSet: ['x'], acceptanceCriteria: ['a'], dependencies: ['b'] },
    { key: 'b', title: 'B', goal: 'B', workerKind: 'code', resourceSet: ['y'], acceptanceCriteria: ['b'], dependencies: ['a'] },
  ],
}), /dependency cycle/)
assert.throws(() => validateEpicManifest({
  schemaVersion: 1,
  epic: { title: 'Unknown dep', goal: 'Detect missing dependency', project: 'test' },
  jobs: [
    { key: 'a', title: 'A', goal: 'A', workerKind: 'code', resourceSet: ['x'], acceptanceCriteria: ['a'], dependencies: ['missing'] },
  ],
}), /unknown dependency/)


const toolsContractFixture = validateAgentContract({
  schemaVersion: 1,
  repository: 'dtfgenetics/Tools',
  controlRepository: 'dtfgenetics/Thc',
  defaultBranch: 'main',
  canonicalDomains: ['cultivation tools', 'Plant Atlas'],
  sourceRoots: ['site/', 'scripts/', 'data/', 'docs/', 'package.json', 'AGENTS.md'],
  protectedPaths: ['.github/workflows/**', '.env*'],
  verificationProfiles: {
    default: { commands: ['npm test'], ciAuthoritative: true },
    experience: { commands: ['npm test', 'npm run audit:experience'], ciAuthoritative: true },
  },
  production: { directMutation: false, integrationOwner: 'dtfgenetics/Thc' },
}, { expectedRepository: 'dtfgenetics/Tools' })
assert.equal(verificationProfileFromContract(toolsContractFixture, 'default').commands[0], 'npm test')
const contractJob = {
  repository: 'dtfgenetics/Tools',
  canonicalDomain: 'cultivation tools',
  baseBranch: 'main',
  workerKind: 'code',
  allowedPaths: ['site/public-route-patch/tools/vpd/**'],
  verificationProfile: 'default',
}
assert.equal(inspectContractScope(contractJob, toolsContractFixture).ok, true)
assert.equal(
  inspectContractScope({ ...contractJob, canonicalDomain: 'not-owned' }, toolsContractFixture)
    .violations.some((item) => item.code === 'canonical-domain-not-owned'),
  true,
)
assert.equal(
  inspectContractScope({ ...contractJob, allowedPaths: ['random/**'] }, toolsContractFixture)
    .violations.some((item) => item.code === 'path-outside-source-roots'),
  true,
)
assert.equal(
  inspectContractScope({ ...contractJob, allowedPaths: ['.github/workflows/**'] }, toolsContractFixture)
    .violations.some((item) => item.code === 'protected-path-requires-maintenance-or-release-worker'),
  true,
)
assert.equal(
  inspectContractScope({ ...contractJob, workerKind: 'repo-maintenance', allowedPaths: ['.github/workflows/**'] }, toolsContractFixture).ok,
  false,
)
assert.throws(() => verificationProfileFromContract(toolsContractFixture, 'missing'), /no verification profile/)

const productionMerged = newJob({ jobId: 'prod-1', title: 'Production', state: 'MERGED', productionImpact: true })
assert.throws(() => transitionJob(productionMerged, 'DONE'), /Production-impacting/)

console.log(JSON.stringify({ ok: true, tests: 149 }, null, 2))


const orchestratorWorkflow = fs.readFileSync('.github/workflows/worker-orchestrator.yml', 'utf8')
assert.match(
  orchestratorWorkflow,
  /name: Claim ready work\n\s+#(?:.|\n)*?if: github\.event_name == 'workflow_dispatch' && inputs\.mode == 'dispatch'/,
  'scheduled orchestration must never lease work without an attached executor',
)
assert.doesNotMatch(
  orchestratorWorkflow,
  /name: Claim ready work\n\s+if: github\.event_name == 'schedule'/,
  'schedule must remain observer/reconciler only',
)
assert.match(orchestratorWorkflow, /uses: actions\/upload-artifact@v4/, 'orchestrator reports must be persisted as workflow evidence')
assert.match(orchestratorWorkflow, /retention-days: 30/, 'orchestrator evidence must have an explicit retention window')


const throughputConfig = {
  ...config,
  scheduling: { agingDaysPerPriorityBoost: 7, requireAcceptanceCriteria: true, requireVerificationProfile: true },
}
const oldP3 = issue(501, 'Old P3', ['worker:ready', 'priority:p3'], '2026-08-01T00:00:00Z')
const newP1 = issue(502, 'New P1', ['worker:ready', 'priority:p1'], '2026-10-01T00:00:00Z')
assert.equal(priorityRank(oldP3, throughputConfig, new Date('2026-10-04T00:00:00Z')), 0, 'old work must age upward to prevent starvation')
assert.equal(priorityRank(newP1, throughputConfig, new Date('2026-10-04T00:00:00Z')), 1)

const incompleteClaim = buildClaim(issue(503, 'Missing done contract', ['worker:ready']), throughputConfig)
assert.deepEqual(claimReadiness(incompleteClaim, throughputConfig).reasons, ['missing-acceptance-criteria'])
const completeIssue = {
  ...issue(504, 'Executable work', ['worker:ready']),
  body: '<!-- worker-plan:{"acceptanceCriteria":["tests pass"],"verificationProfile":"repo-control"} -->',
}
assert.equal(claimReadiness(buildClaim(completeIssue, throughputConfig), throughputConfig).ready, true)

const completionStatus = buildOperatorStatus({
  activeClaims: [
    { issueNumber: 601, state: 'VERIFYING', active: true, executor: { executorId: 'a' }, productionTargets: [] },
    { issueNumber: 602, state: 'INTEGRATION_READY', active: true, productionTargets: [] },
    { issueNumber: 603, state: 'RUNNING', active: true, productionTargets: ['route:/learn/'] },
  ],
})
assert.equal(completionStatus.summary.verifyingJobs, 1)
assert.equal(completionStatus.summary.integrationReadyJobs, 1)
assert.equal(completionStatus.summary.executorAttachedJobs, 1)
assert.equal(completionStatus.summary.productionJobsAwaitingLiveProof, 1)


const integrationScript = fs.readFileSync('scripts/orchestrator-integrate.mjs', 'utf8')
assert.match(integrationScript, /job\.state !== 'INTEGRATION_READY'/)
assert.match(integrationScript, /pr\.state !== 'MERGED'/)
assert.match(integrationScript, /pr\.headRefOid !== job\.verification\.headSha/)
assert.match(integrationScript, /transitionJob\([^\n]+,'MERGED'/)
assert.match(integrationScript, /'DONE'.*non-production-work-complete/)
assert.match(integrationScript, /'PRODUCTION_READY'.*merge-ready-for-production/)

const workflowWithIntegration = fs.readFileSync('.github/workflows/worker-orchestrator.yml', 'utf8')
assert.match(workflowWithIntegration, /- integrate/)
assert.match(workflowWithIntegration, /scripts\/orchestrator-integrate\.mjs/)
assert.match(workflowWithIntegration, /worker-integrate\.json/)


assert.equal(normalizeAcceptanceCriterion('tests pass').legacy, true)
assert.deepEqual(normalizeAcceptanceCriterion({ type: 'path-exists', path: 'scripts/orchestrator.mjs' }), { type: 'path-exists', path: 'scripts/orchestrator.mjs', legacy: false })
assert.equal(inspectAcceptanceContract([{ type: 'check', description: 'CI green' }]).ok, true)
assert.throws(() => normalizeAcceptanceCriterion({ type: 'path-exists' }), /requires path/)
assert.equal(inspectAcceptanceContract([], {}).ok, false)

assert.deepEqual(
  classifyVerificationFailure({ reason: 'checks-failing', checkGate: { failing: [{ name: 'unit' }] } }),
  { class: 'test-or-build', retryPolicy: 'test-or-build', repairWorker: 'test-repair', automatic: true, failingChecks: ['unit'] },
)
assert.equal(classifyVerificationFailure({ reason: 'head-sha-mismatch' }).repairWorker, 'repo-maintenance')
assert.equal(classifyVerificationFailure({ reason: 'changed-files-outside-allowed-paths' }).automatic, false)


const retryConfig = JSON.parse(fs.readFileSync('configuration/orchestrator/retry-policies.json', 'utf8'))
const repairJob = newJob({ jobId:'repair-1', title:'repair me', state:'VERIFYING', acceptanceCriteria:['tests pass'], retryPolicy:'implementation' })
const testFailure = classifyVerificationFailure({ reason:'checks-failing', checkGate:{ failing:[{name:'unit'}] } })
const repairPlan = planRepair(repairJob, testFailure, retryConfig, { now:new Date('2026-10-04T00:00:00Z') })
assert.equal(repairPlan.action, 'REPAIR')
assert.equal(repairPlan.repairWorker, 'test-repair')
assert.equal(repairPlan.attempt, 1)
assert.equal(repairPlan.nextEligibleAt, '2026-10-04T00:05:00.000Z')
assert.equal(applyRepairPlan(repairJob, testFailure, repairPlan, { now:'2026-10-04T00:00:00.000Z' }).state, 'REPAIRING')

const policyFailure = classifyVerificationFailure({ reason:'changed-files-outside-allowed-paths' })
const blockPlan = planRepair(repairJob, policyFailure, retryConfig)
assert.equal(blockPlan.action, 'BLOCK')
assert.equal(blockPlan.state, 'BLOCKED')

const exhausted = { ...repairJob, attempt:3 }
const exhaustedPlan = planRepair(exhausted, testFailure, retryConfig)
assert.equal(exhaustedPlan.state, 'QUARANTINED')


const productionJob = newJob({ jobId:'prod-1', title:'ship it', state:'PRODUCTION_READY', productionImpact:true, productionTargets:['route:/learn/'], acceptanceCriteria:[{type:'production-live',target:'route:/learn/'}] })
const deploying = startProductionRelease(productionJob,{workflowRunId:9001,sourceSha:'abc123',now:'2026-10-04T01:00:00.000Z'})
assert.equal(deploying.state,'DEPLOYING')
const live = recordDeploymentComplete(deploying,{workflowRunId:9001,conclusion:'success',now:'2026-10-04T01:05:00.000Z'})
assert.equal(live.state,'LIVE_VERIFYING')
const done = recordLiveVerification(live,{workflowRunId:9001,sourceSha:'abc123',checks:[{target:'/learn/',ok:true}],now:'2026-10-04T01:06:00.000Z'})
assert.equal(done.state,'DONE')
assert.throws(()=>recordLiveVerification(live,{workflowRunId:9001,sourceSha:'wrong',checks:[{target:'/learn/',ok:true}]}),/does not match release source/)
assert.throws(()=>recordDeploymentComplete(deploying,{workflowRunId:9001,conclusion:'failure'}),/must be success/)


const repairReady = { ...repairJob, state:'REPAIRING', repair:{ workerKind:'test-repair', nextEligibleAt:'2026-10-04T00:00:00.000Z' } }
assert.equal(executorDemand(repairReady,{now:new Date('2026-10-04T00:01:00Z')}).workerKind,'test-repair')
assert.equal(executorDemand({...repairReady,repair:{...repairReady.repair,nextEligibleAt:'2026-10-04T01:00:00.000Z'}},{now:new Date('2026-10-04T00:01:00Z')}).ready,false)
assert.equal(executorQueue([repairReady],{now:new Date('2026-10-04T00:01:00Z')}).length,1)
