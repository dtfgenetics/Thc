# High IQ — Test Higher Cognition

High IQ is the DTF / THC cannabis knowledge game. GitHub owns the machine-readable production dataset, validation, and the self-hosted browser implementation for `https://dtfseeds.com/games/high-iq/`. The approved human production workbook remains the migration/provenance source in Google Drive.

## Self-hosted browser build

The DTF-hosted implementation now lives in:

- `site/public-route-patch/games/high-iq/index.html`
- `site/public-route-patch/games/high-iq/app.js`
- `site/public-route-patch/games/high-iq/high-iq.css`

It loads the source-controlled production bank at runtime and supports category/difficulty filters, variable session lengths, randomized question order, difficulty-weighted scoring, answer explanations, context notes, source links, and A–D / 1–4 keyboard selection.

The previous Base44 build is retained only as a rollback/legacy development link until the DTF-hosted production route has passed live verification. Do not treat the external Base44 application as the canonical runtime after the self-hosted route is verified.

## Production question bank

Dataset **v2.2** was migrated from `High_IQ_Master_Production_Workbook_v2_2.xlsx` on 2026-08-18.

- 80 questions.
- 80/80 status: `Approved`.
- 80/80 audit: `PASS`.
- 50 registered sources.
- Four difficulty levels: Easy, Medium, Hard, Expert.
- Stable question IDs `HIQ-S1-001` through `HIQ-S1-080`.
- Every `correctAnswer` was checked against its A/B/C/D `correctLetter`.
- Every referenced `sourceId` was checked against the migrated source registry.

Runtime data lives under `data/` in eight 10-question chunks and two 25-source chunks. `scripts/validate-data.mjs` rejects duplicates, missing/invalid answers, broken source references, wrong status/audit/version values, invalid URLs, and unexpected category/difficulty totals.

The workbook in Drive remains the controlled human review/production record. Do not edit JSON and then claim the workbook was updated; approved changes must be reconciled back to the controlled workbook or migrated into a clearly versioned successor dataset.

## Production gate

A DTF-hosted release requires:

1. `node games/high-iq/scripts/validate-data.mjs` passes.
2. The browser source passes JavaScript syntax checks.
3. The public-suite build copies all High IQ data chunks into `/games/high-iq/data/`.
4. The packaged route contains a crawlable H1, unique title, description, and canonical URL.
5. Live verification confirms the route loads the question bank and no longer depends on Base44 for normal play.
6. The legacy external URL remains available only as rollback evidence until the DTF route is stable.

See `game.json` for machine-readable integration status and `data/manifest.json` for the production dataset contract.
