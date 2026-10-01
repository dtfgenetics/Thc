# DTF Multi-Chat / Multi-Agent Workspace Architecture

Status: proposed canonical operating model
Updated: 2026-09-30
Control repository: `dtfgenetics/Thc`

## Goal

DTF work must support several ChatGPT/Codex conversations and automated agents progressing at the same time without relying on hidden chat history, duplicating work, overwriting one another, or losing useful results.

A chat is an execution surface. It is not the durable project memory.

The durable system is GitHub plus the DTF registries, job ledger, branches, pull requests, validation evidence, release records, and approved asset stores.

## Core operating rule

Every chat follows:

```text
READ SHARED STATE
      ↓
CLAIM ONE BOUNDED JOB
      ↓
RESOLVE CANONICAL OWNER + RESOURCES
      ↓
WORK ON ONE MANAGED BRANCH
      ↓
WRITE PROGRESS TO DURABLE STATE
      ↓
VERIFY EXACT HEAD
      ↓
OPEN / UPDATE PR
      ↓
HAND OFF OR INTEGRATE
```

No chat should depend on another chat's conversation transcript in order to understand the project.

## Durable layers

### 1. Product catalog

The catalog answers what exists and where it belongs.

Existing authoritative inputs:

- `data/project-registry.json`
- `data/repository-registry.json`
- `data/game-registry-v2.json`
- `data/studio-resources.json`
- `site/deployment/public-apps.json`
- `site/deployment/release-resources.json`
- `data/public-navigation.json`

The controller must resolve a task to one canonical repository and one or more resources before a worker starts.

### 2. Work ledger

GitHub issues are the human/operator view of active work. The machine-readable orchestrator marker is the worker state.

Each job records:

- job ID and parent epic;
- goal;
- canonical repository;
- worker kind;
- allowed resources / paths;
- dependencies;
- acceptance criteria;
- managed branch;
- lease / active worker;
- current state;
- PR;
- exact expected head SHA;
- verification profile and evidence;
- production targets;
- deployment/live verification when applicable;
- handoff notes.

Chats may come and go. The job remains.

### 3. Canonical source

Code/content/schema work lives only in its canonical repository.

Integration mirrors, deployment packages, generated files, chat text, and migration repos cannot silently become alternate sources of truth.

### 4. Artifact store

Large images, videos, 3D models, PDFs, exports, and approved masters must have durable locations with version/provenance metadata.

A chat-generated asset is not complete until it is stored in an approved durable location and referenced from the owning project/job.

### 5. Runtime/release state

Production status must be derived from actual release records and live verification, never from a chat saying a change is live.

## Multi-chat concurrency model

Chats can run simultaneously when their resource claims do not conflict.

Safe example:

```text
Chat A → game.high-iq
Chat B → app.plant-atlas
Chat C → content.education / encyclopedia volume 12
Chat D → tool.vpd
```

Conflicting example:

```text
Chat A → platform.site-shell
Chat B → platform.site-shell
```

The second chat must wait, re-plan, or receive a different resource.

## Resource ownership

Use `data/studio-resources.json` as the primary path/resource classifier rather than creating another parallel resource registry.

Jobs should carry:

```json
{
  "resourceSet": ["game.high-iq"],
  "allowedPaths": [
    "games/high-iq/**",
    "site/public-route-patch/games/high-iq/**"
  ],
  "verificationProfile": "high-iq",
  "productionTargets": ["route:/games/high-iq/"]
}
```

At verification time, changed files outside `allowedPaths` must fail the job until scope is explicitly re-planned.

## Chat roles

A conversation should declare one primary role for each job:

- planner
- research
- code
- game
- content
- data
- test-repair
- visual-qa
- security
- repo-maintenance
- release
- live-qa

A worker that implements a change should not be the only authority that decides the change is correct.

## Shared handoff packet

Every active job must be recoverable using only durable state.

Minimum handoff:

```text
JOB
ID / issue

GOAL
What outcome is required.

OWNER
Canonical repo + resource(s).

BRANCH
Exact managed branch.

CURRENT HEAD
Latest commit SHA.

DONE
Concrete completed work.

REMAINING
Concrete next steps.

BLOCKERS
Evidence-backed blockers only.

VERIFY
Commands/checks already run and their results.

PR
PR number/status if open.

PRODUCTION
Target route/environment and whether deployment/live verification remains.
```

The handoff belongs in the job/PR, not only in chat.

## Project hierarchy

Use four levels:

```text
PROGRAM
DTF / THC Platform

  SYSTEM
  Tools / Education / Academy / Diagnostics / Games / Site

    PROJECT
    e.g. Plant Atlas V4

      JOB
      bounded implementation/research/QA unit
```

A chat normally owns one JOB.

Large user requests should be decomposed into an EPIC plus jobs so several chats can progress independently.

## Branch policy

One logical job = one managed branch.

Do not create:

- `-v2`
- `-final`
- `-new`
- `-retry`

merely because a worker or chat changed.

A replacement worker continues the same branch unless branch integrity is lost or the job is explicitly superseded.

## Chat startup protocol

A fresh chat working on DTF should:

1. Read `AGENTS.md`.
2. Resolve the product in project/repository registries.
3. Read the job record and orchestrator marker.
4. Read the relevant subsystem skill/source-of-truth.
5. Confirm the job branch and current head.
6. Confirm resource lease/ownership.
7. Read current PR/check status.
8. Continue from the recorded remaining work.

It should not ask the user to restate project history that already exists in durable state.

## Chat shutdown / handoff protocol

Before a chat stops or switches tasks:

1. Commit/push useful work where authorized.
2. Update the durable job state.
3. Record completed work and remaining work.
4. Record exact verification results.
5. Record current branch/head/PR.
6. Release or renew the lease according to state.
7. Never leave the only useful result inside the conversation.

## Decision records

Architecture or behavior decisions that affect future work require a durable decision record.

Use short ADR-style records for decisions such as:

- canonical repo changes;
- framework choices;
- route ownership changes;
- schema changes;
- shared UI contracts;
- retirement/migration decisions.

A decision should record context, decision, consequences, superseded alternatives, and date.

## Preventing lost work

The controller/reconciler must detect:

- active job with missing branch;
- branch with unique commits but no active job;
- PR without job;
- job without PR after implementation;
- expired lease with unique work;
- merged PR whose job was not advanced;
- duplicate jobs targeting the same resource/outcome;
- stale verification on an older head;
- generated artifact with no source/provenance record;
- migration repo work not reconciled into a canonical owner.

Unique work is preserved and reassigned, never automatically discarded.

## Acceptance rule for multi-chat readiness

The system is ready for sustained parallel chats when a brand-new chat can receive only a job ID and then independently recover:

- why the job exists;
- where it belongs;
- what it may change;
- what has already been done;
- what remains;
- what tests prove success;
- what PR/release state exists;
- what production target is affected.

If it still needs the prior chat transcript to proceed safely, the durable operating model is incomplete.

## Immediate implementation priorities

1. Populate `resourceSet` during planning.
2. Add `allowedPaths` to the job schema.
3. Derive resources from `data/studio-resources.json`.
4. Block overlapping exclusive resource claims.
5. Populate verification profiles automatically.
6. Populate production targets automatically.
7. Add explicit dependencies and acceptance criteria.
8. Add a standard handoff block to job/PR updates.
9. Expand reconciliation for orphan branches/PRs and lost handoffs.
10. Add operator status output showing jobs, workers, resources, PRs, and blockers.
11. Only after these pass should concurrency be raised beyond the current safe limit.
