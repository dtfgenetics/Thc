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
