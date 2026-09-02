# GitHub Platform Hardening Reference

Use this reference when auditing or improving repository governance, GitHub Actions security, merge safety, code-review quality, release integrity, or long-running repository health.

The repository manager must treat GitHub configuration as part of the software system. A green build is not enough when the production branch is unprotected, required checks are ineffective, deployments can race, secrets can leak, or multiple automation lanes can overwrite the same target.

## Repository protection baseline

Inspect both branch protection and repository rulesets before assuming a branch is protected.

Preferred protections for an actively developed production branch include, when supported and appropriate:

- require pull requests before merge;
- require selected status checks;
- require conversation resolution;
- require branches to be current or use a merge queue;
- prevent force pushes and accidental deletion;
- restrict bypasses when the repository needs strong production governance;
- optionally require signed commits or successful deployments when the project already uses those controls reliably.

If the branch is unprotected, do not interpret that as permission to skip PR, test, review, or synchronization discipline. Report the governance gap separately from the code task.

GitHub rulesets can provide clearer visibility and more flexible policy composition than legacy single branch-protection rules. Do not replace an existing protection model automatically; first compare effective behavior and plan a non-disruptive migration.

When admin/write capability for rulesets is unavailable, record the desired state in source-controlled documentation or configuration, continue following that discipline operationally, and report the missing server-side enforcement as a blocker rather than pretending the repository is protected.

## Production-branch governance target

For a production branch such as `main`, prefer this order of controls when compatible with the repository:

1. PR-required integration rather than casual direct pushes.
2. Required CI checks for the exact candidate commit.
3. Conversation/review resolution before merge.
4. No force-push and no branch deletion.
5. Up-to-date branch requirement or merge queue compatibility testing.
6. Environment-gated production mutation for workflows that possess deployment secrets.
7. Explicit and minimal workflow token permissions.
8. Rollback/revert capability for every production-changing path.

Do not require a check that is routinely skipped by path filters or unavailable on the event used for integration; a permanently pending required check is also a broken governance configuration.

## Required status checks

Required checks are useful only when they are tied to the commit actually being merged.

- Verify the check belongs to the current PR head or merge-group commit.
- When the target branch moved, do not rely on an older green result if repository policy requires the branch to be current.
- If a required check is skipped because of workflow/path conditions, repair the workflow or protection rule rather than bypassing it.
- Avoid ambiguous duplicate check names from unrelated workflows because required checks can become difficult to reason about.
- Treat a check that passed on a different commit as historical evidence, not current approval.

GitHub documents that required checks must have completed successfully in the repository recently to be selectable/effective, and troubleshooting must distinguish head-commit failures from test-merge failures.

## Merge queue awareness

For repositories with frequent concurrent merges, a merge queue can test a PR together with the latest target branch and already queued changes before integration.

When a merge queue is configured:

- do not bypass it merely because a PR is individually green;
- account for `merge_group` workflow events when required checks must run on queue-created merge groups;
- follow the queued check result, not only the original pull-request check result;
- do not manually rebase repeatedly just to imitate what the configured queue already guarantees.

When no merge queue exists, re-read the target head immediately before merge and require the repository's normal current-branch/update policy.

For repositories with many independent projects landing on one production branch, consider a merge queue when repeated last-minute incompatibility or merge races become a meaningful source of failures.

## PR review and fix-review loop

Substantial code or workflow changes should have a review pass before merge when the available environment supports one.

Minimum loop:

1. Inspect the final diff against the intended base.
2. Confirm no unrelated files, generated noise, secrets, or accidental deletions entered the PR.
3. Run the repository's normal tests and static checks.
4. Review security-sensitive and production-changing files more deeply than ordinary content changes.
5. Address valid review comments with focused commits.
6. Re-run the affected checks after fixes.
7. Re-review the new diff when fixes materially changed behavior.
8. Merge only the exact reviewed/tested head.

When CodeRabbit is installed in the execution environment and the task calls for a code-quality/security review, follow the installed CodeRabbit skill/CLI contract. Treat its issues as review input, not as permission to bypass repository tests or GitHub-required reviews. If an external review tool fails, report that tool failure accurately; do not misrepresent a manual review as its output.

Review priorities:

- data loss or destructive behavior;
- authentication/authorization and secret exposure;
- deployment/rollback safety;
- race conditions and concurrency;
- incorrect source-of-truth ownership;
- tests that assert the wrong behavior;
- dependency/supply-chain changes;
- user-visible regressions;
- only then low-impact style issues.

## GitHub Actions least privilege

Treat every workflow token and secret as a production capability.

- Declare `permissions` explicitly where practical.
- Grant `GITHUB_TOKEN` only the permissions needed by the workflow or job.
- Prefer the built-in `GITHUB_TOKEN` for same-repository operations.
- When cross-repository or external service access needs more capability, prefer a GitHub App or short-lived identity over a long-lived broad personal token when feasible.
- For cloud providers supporting OpenID Connect, prefer OIDC with narrowly scoped trust conditions instead of long-lived cloud secrets.
- Do not expose protected secrets to untrusted pull-request code.
- Remember that Dependabot-triggered pull requests normally receive restricted credentials and should not be assumed to have production secrets.

For workflows that write to production, use GitHub environments when available so deployment secrets and protection rules are scoped to the actual deployment job rather than every CI job.

## Deployment environments and protection

A production environment should be treated as a separate protection boundary from `main`.

Audit:

- which branches/tags may deploy;
- whether required reviewers or custom deployment protection rules are appropriate;
- whether self-approval is allowed where approval is used;
- which secrets are environment-scoped versus repository-wide;
- whether deployment concurrency allows two writers to mutate the same live target simultaneously;
- whether failed deployments preserve rollback artifacts/evidence.

Environment secrets should only become available to the job that actually references the protected environment.

## Workflow execution protections

GitHub may offer workflow execution protections/rulesets that limit who or what events can cause Actions to execute. Because this capability can be plan-dependent or preview/organization-scoped, research the current GitHub documentation before configuring it.

Where available and useful, consider it for repositories where users with repository write access could otherwise edit a workflow and immediately execute privileged automation. Do not assume this control exists merely because normal branch rules exist.

## Third-party Actions supply-chain rules

Third-party Actions execute code in the workflow security context.

- Prefer trusted first-party or audited actions.
- For third-party actions, prefer a verified full-length commit SHA rather than a mutable tag when practical.
- Before changing an action version, read release notes or migration notes and confirm runner/runtime compatibility.
- Review whether an action receives credentials, repository write permission, artifacts, caches, or untrusted PR data.
- Do not mechanically update every action during an unrelated repair.
- Treat reusable workflows from external repositories as executable supply-chain dependencies too.

## Secrets and credential handling

- Never print secret values, transformed secret values, private keys, tokens, `.env` contents, or authorization headers.
- Use minimum scopes/permissions and expiration where credentials must exist.
- Prefer fine-grained credentials or GitHub Apps to classic broad PATs.
- Treat secret names as configuration; values remain external.
- If a credential appears committed, stop using it, preserve evidence without redisplaying the value, rotate/revoke it through the appropriate account owner, and remove it from the active source. History rewriting requires separate explicit authorization because it is destructive and may not fully invalidate an already exposed credential.

## Security feature audit

Where the repository plan supports them, check the effective state of:

- dependency graph;
- Dependabot alerts and update configuration;
- secret scanning;
- push protection;
- code scanning;
- dependency review on pull requests;
- CODEOWNERS or equivalent ownership controls for sensitive paths.

Do not claim a feature is enabled merely because a workflow file exists; inspect repository settings/results when accessible.

Secret scanning is especially important because it can inspect Git history and collaboration surfaces for known credential patterns. A detected live credential should be rotated/revoked promptly; removing it from one file is not sufficient remediation by itself.

Dependency review should be considered for repositories where dependency changes land through PRs. It can detect vulnerable dependency additions before merge and should be ordered correctly with dependency submission when both are used.

## Workflow concurrency

Concurrent deployment or mutation workflows can overwrite each other even when each run is individually correct.

- Identify shared production targets.
- Serialize only mutations that share the same live target.
- Avoid using the same concurrency group in a caller and reusable workflow when that would cause the caller to cancel itself.
- Choose `cancel-in-progress` intentionally. It is useful for replaceable preview/CI work and dangerous for transactional production writes unless the workflow is explicitly restart-safe.
- Never let a mutable publication pointer advance merely because a source commit exists; advance it only after the previous required publish/verification state succeeded.

## Reusable workflows

Use reusable workflows to centralize deterministic repeated logic, but keep ownership boundaries clear.

Audit reusable workflow calls for:

- explicit inputs and secrets;
- permission inheritance/restriction;
- event assumptions made by the caller;
- nested-workflow secret flow;
- shared concurrency groups;
- outputs used as release/deployment gates;
- version pinning when called across repositories.

Do not create a generic reusable writer that acquires ownership of unrelated production routes simply to reduce YAML duplication.

## Continuous repository-health loop

When the user authorizes broad repository management, periodically or at the start/end of major work inspect more than the immediate failing file.

Prioritize:

1. failing/cancelled production and required CI;
2. open PRs blocked by conflicts or stale base state;
3. superseded/duplicate PRs that can cause accidental merges;
4. unprotected production branch/ruleset drift;
5. workflows with broad write permissions or risky secret boundaries;
6. multiple writers for the same production target;
7. publication/deployment jobs without rollback and real runtime verification;
8. dependency/security alerts when accessible;
9. stale branches only after confirming they are not active parallel work;
10. dead workflows/docs that still influence operators.

The goal is not to generate a giant audit report. Fix high-confidence, high-impact problems in dependency order, then re-audit the affected surface.

## Repository-manager state machine

For non-trivial repository work, prefer this lifecycle:

`inspect → isolate → reproduce → repair → narrow-test → review → synchronize → PR → exact-head CI → conflict/current-base check → merge/queue → post-merge CI → deployment handoff → runtime verification → cleanup/audit`

If any state fails, remain in that state or move backward to diagnosis. Do not jump forward merely because a later step is easier to run.

## Release and tag safety

Before creating, moving, or deleting tags/releases:

- identify whether artifacts, deployment systems, package registries, or external consumers depend on the tag;
- verify the tag points to the intended tested commit;
- prefer a new corrective release over silently moving an immutable historical release tag unless the repository's release policy explicitly uses floating major/minor action tags;
- never delete a release/tag merely to hide a failed deployment.

## Current authoritative sources

This reference was refreshed against current GitHub documentation in September 2026. Re-research when behavior is version-sensitive or the platform has changed materially.

Primary GitHub Docs topics:

- Managing protected branches and repository rulesets
- Required status checks and their troubleshooting
- Merge queues and `merge_group` workflow events
- Deployment environments and protection rules
- Secure use / least-privilege `GITHUB_TOKEN` guidance
- OpenID Connect for Actions
- Secret scanning and push protection
- Dependency review
- Reusable workflows
- Workflow execution protections when applicable
- Resolving merge conflicts
