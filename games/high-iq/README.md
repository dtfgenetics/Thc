# High IQ — Test Higher Cognition

High IQ is the DTF / THC cannabis knowledge game. GitHub now owns the machine-readable production question/source dataset and website-integration metadata; the approved human production workbook remains the migration/provenance source in Google Drive.

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

The workbook in Drive remains the controlled human review/production record. Do not edit JSON and then claim the workbook was updated; either reconcile approved changes back to the controlled workbook or create a clearly versioned successor migration.

## Current public build

- **Title:** High IQ — Test Higher Cognition
- **Provider:** Base44
- **Public URL:** https://inescapable-grow-smart-lab.base44.app/
- **Status:** Playable external build
- **DTF website route:** `/games/high-iq/`
- **Recorded:** 2026-08-15

The current external runtime remains a dependency until its actual source project is exported or connected. This repository must not pretend the Base44 application source is self-hosted when it is not.

## Migration target

1. Export or connect the actual Base44 project source.
2. Add the browser app under `apps/high-iq-web/` or a dedicated repository.
3. Make the v2.2 GitHub question/source data the validated runtime input instead of duplicating questions by hand.
4. Preserve scoring, categories, responsive behavior, and any authentication/data dependencies.
5. Build and test the self-hosted version.
6. Deploy it to `https://dtfseeds.com/games/high-iq/`.
7. Keep the Base44 URL as a rollback reference until the DTF-hosted build is verified.

See `game.json` for machine-readable integration status and `data/manifest.json` for the production dataset contract.
