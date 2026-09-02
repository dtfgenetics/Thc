# GitHub Platform Hardening Reference

Use this reference when auditing or improving repository governance, GitHub Actions security, merge safety, or release integrity.

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

If the branch is unprotected, do not interpret that as permission to skip PR, test, or synchronization discipline. Report the governance gap separately from the code task.

GitHub rulesets can provide clearer visibility and more flexible policy composition than legacy single branch-protection rules. Do not replace an existing protection model automatically; first compare effective behavior and plan a non-disruptive migration.

## Merge queue awareness

For repositories with frequent concurrent merges, a merge queue can test a PR together with the latest target branch and already queued changes before integration.

When a merge queue is configured:

- do not bypass it merely because a PR is individually green;
- account for `merge_group` workflow events when required checks must run on queue-created merge groups;
- follow the queued check result, not only the original pull-request check result;
- do not manually rebase repeatedly just to imitate what the configured queue already guarantees.

When no merge queue exists, re-read the target head immediately before merge and require the repository's normal current-branch/update policy.

## GitHub Actions least privilege

Treat every workflow token and secret as a production capability.

- Declare `permissions` explicitly where practical.
- Grant `GITHUB_TOKEN` only the permissions needed by the workflow or job.
- Prefer the built-in `GITHUB_TOKEN` for same-repository operations.
- When cross-repository or external service access needs more capability, prefer a GitHub App or short-lived identity over a long-lived broad personal token when feasible.
- For cloud providers supporting OpenID Connect, prefer OIDC with narrowly scoped trust conditions instead of long-lived cloud secrets.
- Do not expose protected secrets to untrusted pull-request code.
- Remember that Dependabot-triggered pull requests normally receive a read-only token and no Actions secrets.

## Third-party Actions supply-chain rules

Third-party Actions execute code in the workflow security context.

- Prefer trusted first-party or audited actions.
- For third-party actions, prefer a verified full-length commit SHA rather than a mutable tag when practical.
- Before changing an action version, read release notes or migration notes and confirm runner/runtime compatibility.
- Review whether an action receives credentials, repository write permission, artifacts, caches, or untrusted PR data.
- Do not mechanically update every action during an unrelated repair.

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

## Workflow concurrency

Concurrent deployment or mutation workflows can overwrite each other even when each run is individually correct.

- Identify shared production targets.
- Serialize only mutations that share the same live target.
- Avoid using the same concurrency group in a caller and reusable workflow when that would cause the caller to cancel itself.
- Choose `cancel-in-progress` intentionally. It is useful for replaceable preview/CI work and dangerous for transactional production writes unless the workflow is explicitly restart-safe.

## Release and tag safety

Before creating, moving, or deleting tags/releases:

- identify whether artifacts, deployment systems, package registries, or external consumers depend on the tag;
- verify the tag points to the intended tested commit;
- prefer a new corrective release over silently moving an immutable historical release tag unless the repository's release policy explicitly uses floating major/minor action tags;
- never delete a release/tag merely to hide a failed deployment.

## Current authoritative sources

This reference was refreshed against current GitHub documentation in September 2026. Re-research when behavior is version-sensitive or the platform has changed materially.

Primary GitHub Docs topics:

- Managing protected branches and rulesets
- About protected branches / merge queues
- Secure use reference for GitHub Actions
- Workflow syntax and `GITHUB_TOKEN` permissions
- OpenID Connect for Actions
- Managing security and analysis settings
- Resolving merge conflicts
