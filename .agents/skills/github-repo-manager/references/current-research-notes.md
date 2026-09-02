# Current GitHub Repository Manager Research Notes

Research refresh: 2026-09-02.

These notes capture the platform facts that materially changed GitHub Repository Manager v2. They are not a frozen specification; re-check GitHub Docs when platform behavior is version-sensitive.

## Findings applied to v2

1. Branch protection and repository rulesets must both be inspected. A branch can be governed by rulesets even when a legacy branch-protection lookup is empty.
2. Merge queues can validate a pull request together with the latest target branch and queued changes; queue-required workflows may need the `merge_group` event.
3. GitHub recommends least-privilege `GITHUB_TOKEN` permissions. Workflows should explicitly request only what they need.
4. GitHub's OIDC support allows compatible cloud deployments to use short-lived federated identity instead of storing long-lived cloud credentials.
5. Third-party Actions are executable supply-chain dependencies. GitHub identifies a full-length commit SHA as the immutable way to pin an Action release.
6. Dependabot pull-request workflows normally run with read-only token behavior and without Actions secrets, which can explain CI differences from normal branches.
7. Rulesets provide a clearer and composable protection model and should be considered when improving governance, but existing protection should not be replaced automatically without comparing effective behavior.
8. Simple merge conflicts may be resolvable in GitHub, while complex conflicts require semantic resolution through Git/working copy tooling. Conflict repair must preserve behavior from both sides rather than blindly selecting one side.
9. Secret scanning, push protection, code scanning, dependency alerts, and dependency review should be considered during broad repository audits when supported by the repository/account plan.
10. Reusable workflow permissions can only stay the same or become more restrictive through the call chain; workflow concurrency groups also need care to avoid self-cancellation between caller and called workflows.

## Current DTF repo governance observation

At the time of this research, `dtfgenetics/Thc` reported:

- production/default work on `main`;
- `main` not protected by a legacy branch-protection rule;
- no repository rulesets returned by the repository rulesets API.

The manager therefore treats protection as a governance gap to report, not as permission to bypass PR/CI discipline.

## Authoritative documentation consulted

- GitHub Docs: Managing a branch protection rule
- GitHub Docs: About protected branches / merge queues
- GitHub Docs: Converting branch protections to rulesets
- GitHub Docs: Secure use reference for GitHub Actions
- GitHub Docs: Workflow syntax for GitHub Actions
- GitHub Docs: GITHUB_TOKEN
- GitHub Docs: OpenID Connect reference and cloud-provider guidance
- GitHub Docs: Managing security and analysis settings
- GitHub Docs: Resolving merge conflicts
