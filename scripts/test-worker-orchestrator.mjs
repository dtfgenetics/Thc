#!/usr/bin/env node

import assert from 'node:assert/strict'
import { buildClaim, isReady, planClaims, validateConfig } from './orchestrator/core.mjs'
import { newJob, transitionJob, canTransition } from './orchestrator/state.mjs'
import { createLease, heartbeatLease, isLeaseExpired, recoveryDisposition } from './orchestrator/leases.mjs'
import { classifyReconciliation, reconciliationNeedsMutation } from './orchestrator/reconcile.mjs'

const config = validateConfig({
  version: 2,
  baseBranch: 'main',
  maxWorkers: 3,
  maxWorkersPerProject: 1,
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
})

assert.equal(isReady(issue(1, 'Ready', ['worker:ready']), config), true)
assert.equal(isReady(issue(2, 'Claimed', ['worker:ready', 'worker:claimed']), config), false)
assert.equal(isReady(issue(3, 'Blocked', ['worker:ready', 'worker:blocked']), config), false)
assert.equal(isReady(issue(31, 'Running', ['worker:ready', 'worker:running']), config), false)

const claim = buildClaim(issue(4, 'Fix broken game shell', ['worker:ready', 'worker:audit', 'project:games']), config)
assert.equal(claim.project, 'games')
assert.equal(claim.kind, 'audit')
assert.match(claim.branch, /^work\/games\/fix-broken-game-shell-i4-[a-f0-9]{7}$/)

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

const productionMerged = newJob({ jobId: 'prod-1', title: 'Production', state: 'MERGED', productionImpact: true })
assert.throws(() => transitionJob(productionMerged, 'DONE'), /Production-impacting/)

console.log(JSON.stringify({ ok: true, tests: 29 }, null, 2))
