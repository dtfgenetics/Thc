# High IQ — Test Higher Cognition

High IQ is the DTF / THC source-backed cannabis plant-science knowledge game for `https://dtfseeds.com/games/high-iq/`. GitHub owns the machine-readable production dataset, validation, browser runtime, gameplay tests, authoring workflow, and deployable public mirror. The approved human production workbook remains the controlled migration/provenance source.

## Current browser build

The production-readiness v3 layer lives in:

- `site/public-route-patch/games/high-iq/index.html`
- `site/public-route-patch/games/high-iq/app-v3.js`
- `site/public-route-patch/games/high-iq/game-core.mjs`
- `site/public-route-patch/games/high-iq/high-iq.css`
- `site/public-route-patch/games/high-iq/high-iq-v3.css`

The previous `app.js` remains in the public route as rollback/reference code while v3 completes live verification, but `index.html` targets `app-v3.js`.

V3 features include Balanced Mix and Random Mix sessions, deterministic Daily 10, variable session lengths, category/difficulty filters, difficulty-weighted scoring, live accuracy/streak tracking, explanations/context/source links, missed-question review, practice-missed reruns, local run history, personal bests, sharing, topic/source coverage views, keyboard controls, reduced-motion support, forced-colors support, and explicit data-retry diagnostics.

## Production question bank

The canonical manifest currently declares dataset **v2.3** with **160 Approved/PASS questions**, **50 registered sources**, **10 topic domains**, and four difficulty levels: Easy, Medium, Hard, and Expert.

Question IDs are continuous and stable (`HIQ-S1-001` through the current manifest count). Every `correctAnswer` is validated against its A/B/C/D `correctLetter`, every referenced `sourceId` is validated against the source registry, and the public runtime copies must match the canonical bank byte-for-byte.

Question chunks are declared by `games/high-iq/data/manifest.json`. Runtime and packaging code must read that manifest rather than assuming a fixed number of chunks. New approved questions can therefore extend the bank without rewriting gameplay code.

The workbook in Drive remains the controlled human review/production record. Approved content changes must be reconciled back to that workbook or migrated into a clearly versioned successor dataset; browser feature work must not silently rewrite approved question content.

## Adding or editing questions

High IQ has a dedicated content-maintenance CLI. Use it instead of manually hunting through chunk files.

```bash
# Show commands
npm run hiq:questions

# Create a ready-to-edit question template
npm run hiq:question-template -- /tmp/high-iq-question.json

# Find a question and the chunk that owns it
npm run hiq:questions -- get HIQ-S1-160

# Search question IDs, categories, difficulty, or question text
npm run hiq:questions -- list "Plant Biology"

# Promote one reviewed question into the canonical bank
npm run hiq:questions -- promote /tmp/high-iq-question.json

# Safely edit an existing question with a JSON patch
npm run hiq:questions -- edit HIQ-S1-160 /tmp/high-iq-patch.json

# Re-sync canonical data to the public runtime and validate
npm run hiq:questions -- sync
```

`promote` assigns the next ID when one is not provided, creates/uses the correct versioned question chunk, updates manifest counts/distributions, copies changed data to the public runtime, synchronizes visible shell metadata, and runs validation. `edit` locates a question by ID so maintainers do not need to know which chunk owns it.

Promotion/edit rejects duplicate IDs or duplicate question text, missing A–D choices, invalid answer mappings, invalid difficulty/point combinations, missing explanations/context, unknown sources, and records that are not in the required Approved/PASS state.

## Manifest-driven shell and packaging

`games/high-iq/scripts/sync-runtime-shell.mjs` synchronizes the crawlable HTML shell from the manifest. The hero question count, topic count, source count, dataset version, and approved-question copy therefore follow the bank automatically.

`games/high-iq/scripts/validate-data.mjs` runs shell synchronization after dataset validation, so the normal public-suite build receives current visible metadata before packaging.

High IQ CI also opens the generated WordPress game-route archive, reads the packaged High IQ manifest, and requires every question/source chunk declared by that manifest. This prevents a future question expansion from being silently omitted by an old hand-maintained chunk list.

## Tests and production gates

Run the primary checks before promotion:

```bash
npm run hiq:validate
node games/high-iq/test/question-bank-tool.test.mjs
node games/high-iq/test/browser-smoke.mjs
```

The broader validation stack includes:

```bash
node games/high-iq/scripts/validate-data.mjs
node games/high-iq/scripts/validate-public-runtime.mjs
node games/high-iq/test/game-core.test.mjs
node games/high-iq/test/runtime-smoke.mjs
node --check site/public-route-patch/games/high-iq/app-v3.js
node --check site/public-route-patch/games/high-iq/game-core.mjs
node --check games/high-iq/scripts/question-bank.mjs
node --check games/high-iq/scripts/sync-runtime-shell.mjs
node --check games/high-iq/scripts/verify-live-v3.mjs
```

For the real-browser gate, install the workspace plus Chromium and run:

```bash
npm ci
npx playwright install chromium
node games/high-iq/test/browser-smoke.mjs
```

The browser smoke test serves `site/public-route-patch` locally, loads the complete manifest-declared bank in Chromium, completes a five-question challenge through the results screen, verifies explanations/sources/history, checks for browser console/page errors, tests keyboard behavior, and performs a 390×844 mobile overflow check.

After deployment, run the live production verifier:

```bash
node games/high-iq/scripts/verify-live-v3.mjs
```

A DTF-hosted High IQ release requires canonical data validation, synchronized public data, authoring-tool tests, deterministic gameplay-core tests, runtime DOM/data contract checks, manifest-derived package verification, real Chromium playthrough, mobile overflow verification, and a passing post-deploy live verifier before `production_route_verified` is considered true.

See `game.json` for the machine-readable feature/integration contract and `data/manifest.json` for the controlled dataset contract.
