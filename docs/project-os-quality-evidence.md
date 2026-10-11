# Project OS quality evidence contract

This is a **read-only audit** of the canonical project registry and public apps manifest. It never changes deployment status or declares undocumented applications ready.

Run:

```sh
node --test scripts/project-os-quality-evidence.test.mjs
node scripts/project-os-quality-evidence.mjs
```

The evaluator writes `.artifacts/project-os/quality-evidence.json`. Unknown evidence is not a pass.

A future `data/project-os-quality-evidence.json` file may contain:

```json
{
  "schemaVersion": 1,
  "applications": [
    {
      "appId": "high-land",
      "repository": "dtfgenetics/Thc",
      "commitSha": "REPLACE_WITH_40_CHARACTER_COMMIT_SHA",
      "categories": {
        "source": {"status":"pass","url":"https://github.com/EXAMPLE","commitSha":"REPLACE_WITH_40_CHARACTER_COMMIT_SHA","verifiedAt":"2026-10-11T10:00:00Z"}
      }
    }
  ]
}
```

All **six** required categories must carry valid, consistent proof: `source` (owner and branch), `build` (tests and build), `responsive` (desktop/mobile browser acceptance), `content` (assets and instructional review), `security` (scans and authorization checks), `production` (deployed revision and rollback verification). A category passes only with an HTTPS proof link, immutable 40-hex source commit and UTC timestamp not older than 30 days. Linking to a workflow is **not itself proof it passed**; evidence ingestion must separately verify workflow status and artifact identity before registering evidence. This v1 evaluator checks submitted proof metadata, **not** remote GitHub workflow conclusions.

CI audits registry integrity and generates evidence reports without treating incomplete projects as CI failures. Use `--enforce` only for designated complete-product release gates after verified evidence ingestion is operational. Never use the report's `ready` result alone to authorize production deployment.

## Read-only GitHub Actions observation collector

The workflow runs `node --test scripts/project-os-workflow-observations.test.mjs` and `node scripts/project-os-workflow-observations.mjs` with read-only `actions: read` permission. It queries GitHub's Actions API for the exact PR head SHA (or main SHA), ignores failed, skipped, pending, unrelated and stale runs, and publishes `.artifacts/project-os/workflow-observations.json`. No token is placed in the artifact.

**Not an approval gate:** A successful workflow observation does not prove that all jobs passed, that a particular application or route was tested, or that its deployment matches the SHA. Accordingly observations are not promoted to passing evidence in the six-category audit. The next phase must verify run attempts, required jobs, artifacts and application-scoped coverage before promotion.

## Application-specific attribution contract

`scripts/project-os-app-coverage.mjs` provides an additional fail-closed predicate: a passing build observation cannot be attributed to an application without both an app-scoped successful job and an immutable artifact matching the exact revision, run ID and attempt. Other apps' success cannot be inherited. The accompanying tests cover missing, failed, skipped, cross-app, stale-attempt and invalid-digest cases.

The job and artifact inputs are a **contract for a future trusted attestation producer**, not yet sourced and cryptographically verified from GitHub. The checks are not wired to a production release gate. Never treat untrusted `appIds` fields or synthetic fixtures as deployment approval.
