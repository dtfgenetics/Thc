# Git Operations and Recovery Reference

Use this reference for push/pull synchronization, divergence, merge conflicts, rebases, cherry-picks, accidental commits, bad merges, release repair, and other repository-state problems.

## Do not start with `git pull`

A blind pull can create a merge commit, rebase local work, or collide with uncommitted changes depending on local configuration. Start with evidence:

```bash
git status --short --branch
git remote -v
git fetch --all --prune
git branch -vv
git log --oneline --decorate --graph -n 30 --all
```

Then choose the operation deliberately.

## Synchronization decision matrix

### Local branch has no unique commits and is behind

Prefer a fast-forward update:

```bash
git merge --ff-only origin/<branch>
```

### Feature branch has unique commits and target moved

Choose based on repository policy and whether the branch is already shared:

- rebase when the branch is private/owned by the current work and rewriting it is permitted;
- merge target into the feature branch when preserving shared branch history is safer;
- use the PR platform update mechanism when the repository expects it;
- if a merge queue is configured, do not repeatedly rewrite the branch only to emulate queue behavior.

### Production/default branch diverged locally

Do not force-push or rewrite it. Preserve local commits on a new branch, restore the production branch to the remote state, and integrate the local work through a reviewed PR.

### One known commit belongs on another branch

Use cherry-pick only when transplanting that specific commit is semantically correct. Check for dependencies on earlier commits first.

## Push rules

Before pushing:

```bash
git status --short --branch
git log --oneline --decorate @{u}..HEAD 2>/dev/null || true
```

Then:

- push the intended feature branch, not whichever branch happens to be checked out;
- verify the remote/branch destination;
- do not force-push `main`/production;
- if a feature-branch history rewrite is necessary and repository policy allows it, use `--force-with-lease`, never plain `--force`, and only after verifying the expected remote tip;
- if the branch belongs to multiple people/agents, prefer a merge or a new replacement branch over rewriting their history.

## Conflict classification

Before editing, classify each conflict:

- content/content: both sides changed overlapping text;
- modify/delete: one side changed a file the other removed;
- rename/rename: both sides renamed differently;
- add/add: both sides created the same path;
- generated/lockfile conflict: source manifests and generated output disagree;
- binary conflict: the tool cannot safely combine bytes;
- product/behavior conflict: both versions are valid code but represent different decisions.

The resolution strategy depends on the class.

## Semantic merge procedure

For each conflicted path:

1. Read base, target-side, and topic-side versions when available.
2. Read callers/tests/source-of-truth documentation.
3. Identify independent behaviors introduced by each side.
4. Construct the desired final behavior; do not merely select a side.
5. Regenerate derived files from the reconciled source when a generator exists.
6. Run syntax/type/tests for that subsystem.
7. Search for conflict markers and accidental duplicate blocks.
8. Review the final diff against both parents to ensure neither required behavior disappeared.

Do not use blanket `ours`/`theirs` across a conflict set.

## Important ours/theirs warning

The meaning of "ours" and "theirs" depends on the Git operation. During rebase/cherry-pick it can be counterintuitive compared with a normal merge. Do not resolve by option name alone; inspect the actual file content and commit identities.

## Lockfile and generated-file conflicts

If package manifests changed on both sides:

1. reconcile the manifests first;
2. use the repository's declared package manager/version;
3. regenerate the lockfile;
4. run the install/build/test path;
5. do not hand-merge large lockfiles unless regeneration is impossible and the package manager semantics are understood.

For generated site/data artifacts, repair the canonical source first, then regenerate.

## Abort and checkpoint rules

Before a risky rebase/cherry-pick/merge on meaningful work, ensure the current commits are reachable from a branch/ref.

When an operation becomes unclear, abort rather than stacking guesses:

```bash
git merge --abort
git rebase --abort
git cherry-pick --abort
```

Use the command matching the active operation.

## Recovery hierarchy

Prefer the least destructive recovery that preserves evidence:

1. fix forward with a new commit;
2. revert a bad commit/merge when it has already been shared;
3. abort an in-progress operation;
4. recover an unreferenced local commit through `git reflog` and create a branch pointing to it;
5. reset/rewrite only private, explicitly owned history when it is safe and necessary;
6. repository-wide history rewriting is exceptional and requires explicit destructive authorization.

Never delete evidence merely to make the graph look clean.

## Bad merge recovery

If a bad merge is already on a shared production branch, prefer `git revert -m <parent> <merge-sha>` after determining the correct mainline parent. Test the revert and understand that later re-merging the same topic may require a deliberate follow-up strategy because Git records the original merge ancestry.

Do not reset a shared production branch backward just because a revert commit looks less tidy.

## Uncommitted work

Never discard unknown working-tree changes.

- inspect them;
- determine ownership/scope;
- commit them to the correct project branch when they belong to the active task;
- otherwise isolate them in their existing worktree or a safe temporary commit/branch according to repository policy;
- do not use `git reset --hard`, `git clean -fd`, or stash-pop workflows blindly on a shared checkout.

## Binary files

Do not manufacture a byte-level merge for binaries. Determine which artifact is authoritative, whether a source file can regenerate it, and whether both versions should coexist under distinct names. Validate file type/signature after resolution.

## Final synchronization check

Before merge or final push, record:

```bash
git status --short --branch
git rev-parse HEAD
git rev-parse origin/<target>
git log --oneline --decorate --graph -n 20 HEAD origin/<target>
```

Then verify the exact PR head and CI result after the remote operation. Local Git success is not remote CI success.
