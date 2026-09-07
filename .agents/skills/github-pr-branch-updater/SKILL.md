---
name: github-pr-branch-updater
description: Update an open same-repository pull request branch with the latest base branch in one guarded operation, without rewriting branch history. Use when a PR is behind its target branch, when CI must be rerun against the current base, or before mergeability/CI evaluation after the base moved.
compatibility: GitHub repositories with Actions enabled. Uses GitHub's Update a pull request branch REST endpoint and requires pull-requests:write plus contents:write for the repository token.
metadata:
  author: dtfgenetics
  version: "1.0.0"
---

# GitHub PR Branch Updater

Use this skill to replace hand-built merge-tree updates when an open pull request simply needs the latest target branch merged into its head branch.

## Preferred operation

Use GitHub's native update-branch endpoint with the PR's exact current head SHA:

`PUT /repos/{owner}/{repo}/pulls/{pull_number}/update-branch`

Pass `expected_head_sha` from a fresh PR read. This makes stale-head races fail closed instead of updating a branch that moved after inspection.

For repositories carrying `.github/workflows/update-pr-branch.yml`, the operator path is:

**Actions → Update PR Branch → Run workflow → enter PR number**.

## Safety contract

Before updating:

1. Fetch the live PR.
2. Require `state=open`.
3. Capture `head.sha`, `head.ref`, `head.repo.full_name`, `base.sha`, and `base.ref`.
4. Require the head repository to equal the base/current repository when using the repository `GITHUB_TOKEN`.
5. Compare base and head. If `behind_by == 0`, return success without mutation.
6. Call update-branch with `expected_head_sha`.
7. Confirm the PR head advances.
8. Treat the new head as a new integration candidate: all old green checks are stale until required workflows pass on the new SHA.

Do not force-push, reset, or rebuild a synthetic tree merely to update a normal PR branch when this endpoint is available.

## When not to use it

Do not use this operation when:

- the PR has real merge conflicts requiring semantic reconciliation;
- the head is in a fork and the available token cannot write that fork;
- the intended operation is rebase rather than merge-base synchronization;
- the PR is closed or superseded;
- repository policy requires a merge queue to own compatibility updates;
- unique branch work first needs recovery or conflict analysis.

In those cases, hand control back to `github-repo-manager` and follow its conflict/recovery flow.

## Verification

A successful API acceptance is not the completion condition. Verify:

- the PR head SHA changed when it was behind;
- the new head contains the latest base;
- required workflows were triggered for the new SHA;
- exact-head CI completes successfully before merge;
- mergeability is re-read after GitHub recalculates it.

## Installation template

Canonical workflow: `.github/workflows/update-pr-branch.yml` in `dtfgenetics/Thc`.

For another repository, copy that workflow unchanged unless repository-specific permissions or policy require stricter settings. Keep the endpoint, exact-head guard, same-repo check, no-op comparison, and post-update verification intact.

## Relationship to other skills

- `github-repo-manager`: owns overall PR, CI, merge, conflict, branch lifecycle, and recovery decisions.
- `dtf-system-orchestrator`: decides which repository/PR should advance next.
- `dtf-parallel-studio`: owns concurrency and branch/worktree isolation for active implementation.

This skill is intentionally narrow: one safe operation, one reusable button, one exact outcome.
