# Repository Manager Operations Checklist

Use this as a compact execution checklist after reading `SKILL.md`.

## Before changing anything

- [ ] Read repository instructions and subsystem skill.
- [ ] Identify repo, default/production branch, current SHA, and active worktree.
- [ ] Fetch current remote state and inspect divergence.
- [ ] Check open PRs that touch the same ownership surface.
- [ ] Check branch protection, rulesets, required checks, merge queue, and recent failing workflows when relevant.
- [ ] Identify canonical source vs generated output.
- [ ] Preserve unrelated/uncommitted/concurrent work.

## During repair

- [ ] Reproduce or inspect the exact failure.
- [ ] Classify the failure before patching.
- [ ] Make the smallest root-cause fix.
- [ ] Add/update regression coverage when practical.
- [ ] Run narrow validation first, then required repository gates.
- [ ] If the first fix fails, inspect new evidence and research the exact current behavior.
- [ ] Do not repeat an unchanged failed attempt.

## Before push/PR

- [ ] Re-read destination head.
- [ ] Verify branch/worktree ownership.
- [ ] Review diff for unrelated changes, conflict markers, secrets, generated drift, and accidental deletions.
- [ ] Verify target remote/branch explicitly.
- [ ] Push feature/integration branch according to policy.
- [ ] Open/update focused PR.

## Before merge

- [ ] PR is not superseded.
- [ ] Conflicts resolved semantically.
- [ ] Required review conversations resolved when applicable.
- [ ] Exact PR head checks pass.
- [ ] Target has not moved incompatibly.
- [ ] Use merge queue when configured/required.
- [ ] Merge with repository-approved method.

## After merge

- [ ] Follow CI for exact integrated commit/merge-group result.
- [ ] If deployment is requested, follow the owning production workflow separately.
- [ ] Verify real public/runtime behavior before saying live.
- [ ] Record final SHA, PR, run IDs, remaining blockers, and rollback/revert state.
