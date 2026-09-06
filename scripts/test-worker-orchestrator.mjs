#!/usr/bin/env node

import assert from 'node:assert/strict'
import { buildClaim, isReady, planClaims, validateConfig } from './orchestrator/core.mjs'

const config = validateConfig({
  version: 1,
  baseBranch: 'main',
  maxWorkers: 3,
  maxWorkersPerProject: 1,
  labels: {
    ready: 'worker:ready',
    claimed: 'worker:claimed',
    blocked: 'worker:blocked',
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

console.log(JSON.stringify({ ok: true, tests: 8 }, null, 2))
