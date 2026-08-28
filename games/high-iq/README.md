# High IQ — Test Higher Cognition

High IQ is the DTF / THC source-backed cannabis plant-science knowledge game for `https://dtfseeds.com/games/high-iq/`. GitHub owns the machine-readable production dataset, validation, browser runtime, gameplay tests, and deployable public mirror. The approved human production workbook remains the controlled migration/provenance source.

## Current browser build

The production-readiness v3 layer lives in:

- `site/public-route-patch/games/high-iq/index.html`
- `site/public-route-patch/games/high-iq/app-v3.js`
- `site/public-route-patch/games/high-iq/game-core.mjs`
- `site/public-route-patch/games/high-iq/high-iq.css`
- `site/public-route-patch/games/high-iq/high-iq-v3.css`

The previous `app.js` remains in the public route as rollback/reference code while v3 completes live verification, but `index.html` now targets `app-v3.js`.

V3 features include:

- Balanced Mix question sampling across topic/difficulty buckets.
- Random Mix for a classic shuffled challenge.
- Deterministic Daily 10 keyed to local calendar date plus dataset version.
- Variable session lengths and category/difficulty filters.
- Difficulty-weighted scoring, live accuracy, current streak, and best streak.
- Answer explanations, context notes, source links, source organization type, and verification-use context.
- Missed-question review and one-click practice of missed questions.
- Local browser run history and dataset-version-specific personal best.
- Web Share API support with clipboard fallback.
- Topic, difficulty, and source-coverage visualization generated from the manifest/source registry.
- Keyboard A–D / 1–4 selection and Enter lock/advance behavior.
- Skip navigation, reduced-motion support, forced-colors support, and explicit data-retry diagnostics.

The legacy Base44 build remains rollback-only until the self-hosted production route passes live v3 verification.

## Production question bank

Dataset **v2.2** was migrated from `High_IQ_Master_Production_Workbook_v2_2.xlsx` on 2026-08-18.

- 80 questions.
- 80/80 status: `Approved`.
- 80/80 audit: `PASS`.
- 50 registered sources.
- Four difficulty levels: Easy, Medium, Hard, Expert.
- Stable question IDs `HIQ-S1-001` through `HIQ-S1-080`.
- Every `correctAnswer` is validated against its A/B/C/D `correctLetter`.
- Every referenced `sourceId` is validated against the source registry.

Runtime data lives under `data/` in eight 10-question chunks and two 25-source chunks. `scripts/validate-data.mjs` rejects duplicates, missing/invalid answers, broken source references, wrong status/audit/version values, invalid URLs, and unexpected category/difficulty totals.

The workbook in Drive remains the controlled human review/production record. Approved content changes must be reconciled back to that workbook or migrated into a clearly versioned successor dataset; browser feature work must not silently rewrite approved question content.

## Tests and production gates

Run these checks before promotion:

```bash
node games/high-iq/scripts/validate-data.mjs
node games/high-iq/scripts/validate-public-runtime.mjs
node games/high-iq/test/game-core.test.mjs
node games/high-iq/test/runtime-smoke.mjs
node --check site/public-route-patch/games/high-iq/app-v3.js
node --check site/public-route-patch/games/high-iq/game-core.mjs
node --check games/high-iq/scripts/verify-live-v3.mjs
```

For the real-browser gate, install the workspace plus Chromium and run:

```bash
npm ci
npx playwright install chromium
node games/high-iq/test/browser-smoke.mjs
```

The browser smoke test serves `site/public-route-patch` locally, loads the complete production bank in Chromium, completes a five-question challenge through the results screen, verifies explanations/sources/history, checks for browser console/page errors, and performs a 390×844 mobile overflow check.

After deployment, run the live production verifier:

```bash
node games/high-iq/scripts/verify-live-v3.mjs
```

`verify-live-v3.mjs` checks the actual `dtfseeds.com` High IQ route for the Daily 10 and missed-review v3 shell, downloads the live v3 JavaScript/core/CSS assets, then fetches the manifest plus all eight question chunks and both source chunks. It fails if the site serves stale HTML, non-JSON data, duplicate IDs, incomplete counts, or missing v3 assets. Set `HIGH_IQ_LIVE_ORIGIN` only when validating a deliberate alternate deployment target.

A DTF-hosted v3 release requires:

1. Canonical data validation passes.
2. The public data mirror exactly matches the canonical 80-question / 50-source bank.
3. Deterministic gameplay-core tests pass.
4. Runtime smoke validation proves every JavaScript UI selector has a matching production DOM element and all data chunks load to the expected totals.
5. Browser and post-deploy verifier syntax checks pass.
6. The WordPress game-route package contains `app-v3.js`, `game-core.mjs`, both High IQ CSS layers, all data chunks, a crawlable H1, unique title, description, and canonical URL.
7. Chromium completes an actual High IQ run on desktop and loads without horizontal overflow at the tested mobile viewport.
8. `verify-live-v3.mjs` passes against the production origin after deployment.
9. Only after the live verifier passes should `production_route_verified` become `true`.
10. The legacy external URL remains rollback-only evidence until the self-hosted route is stable.

See `game.json` for the machine-readable feature/integration contract and `data/manifest.json` for the controlled dataset contract.
