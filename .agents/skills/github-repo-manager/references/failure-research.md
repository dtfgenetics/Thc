# Failure Research Playbook

Use this reference after an attempted repair still fails, or immediately when the failure depends on current package, platform, API, GitHub Actions, runtime, or deployment behavior.

## Goal

Turn the exact failure evidence into a new repair hypothesis. Research must reduce uncertainty and change what is tried next.

## Evidence packet

Before searching, capture:

- exact error text and failing command;
- workflow/run/job/step identifiers when applicable;
- repository, branch, and commit SHA;
- operating system/runner;
- language/runtime version;
- package manager and lockfile;
- package/action/framework version implicated by the failure;
- relevant config/workflow fragment;
- whether the same step passed on a recent known-good commit.

Redact secret values. Do not copy credentials into search queries.

## Research order

Search in this order whenever possible:

1. Official product/package/action documentation for the exact current version.
2. Official release notes, migration guides, deprecations, and breaking-change notes.
3. Maintainer repository issues/discussions for the exact error string or behavior.
4. Recent upstream commits or changelog entries when the failure may be newly introduced.
5. GitHub Actions documentation for runner, permissions, token, environment, artifact, cache, concurrency, or event behavior.
6. Hosting/deployment provider documentation when the failure occurs after build/CI.
7. High-quality community reports only when primary sources do not explain the issue.

Prefer sources matching the actual version and date of the failing environment. A fix for an older major version is not evidence that it applies now.

## Search construction

Start narrow. Useful queries combine:

- the exact distinctive error phrase;
- package/action/tool name;
- exact or major version;
- runner/platform;
- the failing operation.

Examples:

- `"Cannot find module" pnpm 10 GitHub Actions node 24`
- `actions/upload-artifact v4 hidden files behavior`
- `Hostinger deploy permission denied public_html GitHub Actions`
- `Vite base path assets 404 subdirectory deployment`

Then broaden only if the exact search is empty or misleading.

## Compare against the repository

Do not accept a web answer until it matches the repository's facts.

Check:

- Does the documented command/config exist in this version?
- Is the repository using the documented package manager/runtime?
- Is the failing file generated from another source?
- Did a recent repository commit change the implicated line/config?
- Does a known-good earlier commit show the old working form?
- Is the failure actually a verifier bug rather than the underlying operation?

## Choose the next fix

The next attempt must be materially justified by evidence. Typical evidence-based changes include:

- pinning or upgrading one action/package to a compatible version;
- changing one deprecated option to its current replacement;
- correcting runner permissions or workflow `permissions` declarations;
- fixing a working directory/path/base URL mismatch;
- regenerating a lockfile with the repository's package manager;
- correcting an environment variable name without exposing its value;
- updating a health check to verify the real deployed path;
- reverting a newly introduced regression to the last known-good implementation.

Avoid shotgun changes that modify several unrelated systems at once.

## Retest hierarchy

After the researched fix:

1. Run the narrowest reproducer first.
2. Run the relevant unit/integration test.
3. Run the package/app build.
4. Run repository-required validation.
5. Commit/push the fix.
6. Follow CI for the exact new commit.
7. If deployment is in scope, verify the target environment separately.

## Repeated failure rule

If the new attempt fails:

- read the new logs instead of assuming it is the same failure;
- compare the error signature with the prior run;
- decide whether the failure moved forward, changed category, or stayed identical;
- if identical, challenge the previous hypothesis and research a different cause;
- if it moved forward, preserve the successful earlier fix and address the new blocker;
- after two weak or disproven hypotheses, widen the investigation to recent repository history, upstream breaking changes, and environment/deployment boundaries.

Never create an infinite loop of rerunning unchanged code.

## Research reporting

When research materially changes the fix, record:

- the exact failure category;
- authoritative source(s) consulted;
- version/date fact that mattered;
- why the prior attempt was insufficient;
- what changed in the new repair;
- outcome after retest.

Keep quotations minimal. Summarize the technical conclusion and preserve source links/citations when the interface supports them.
