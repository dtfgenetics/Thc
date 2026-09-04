# High IQ — Test Higher Cognition

High IQ is the DTF / THC source-backed cannabis plant-science knowledge game for `https://dtfseeds.com/games/high-iq/`. GitHub owns the machine-readable production dataset, validation, browser runtime, gameplay tests, authoring workflow, and deployable public mirror. The approved human production workbook remains the controlled migration/provenance source.

## Current release candidate

High IQ v2.4 / UI v3.3 is the current release candidate. Its browser runtime lives in:

- `site/public-route-patch/games/high-iq/index.html`
- `site/public-route-patch/games/high-iq/app-v3.js`
- `site/public-route-patch/games/high-iq/game-core.mjs`
- `site/public-route-patch/games/high-iq/high-iq.css`
- `site/public-route-patch/games/high-iq/high-iq-v3.css`
- `site/public-route-patch/games/high-iq/high-iq-v3-3.css`

The previous `app.js` remains rollback/reference code. `index.html` targets `app-v3.js`; v3.3 is an additive gameplay-first presentation layer so visual work stays separate from scoring and question logic.

The browser game includes Balanced Mix and Random Mix sessions, deterministic Daily 10, variable session lengths, category/difficulty filters, difficulty-weighted scoring, live accuracy/streak tracking, explanations/context/source links, missed-question review, practice-missed reruns, local run history, personal bests, sharing, topic/source coverage views, keyboard controls, reduced-motion support, forced-colors support, and explicit data-retry diagnostics.

## Production question bank

The canonical release-candidate manifest declares dataset **v2.4** with **200 Approved/PASS questions**, **50 registered sources**, **10 topic domains**, and four difficulty levels: Easy, Medium, Hard, and Expert.

Question IDs are continuous and stable (`HIQ-S1-001` through the current manifest count). Every `correctAnswer` is validated against its A/B/C/D `correctLetter`, every referenced `sourceId` is validated against the source registry, and public runtime data must match the canonical bank byte-for-byte.

Question chunks are declared by `games/high-iq/data/manifest.json`. Runtime, validation, and packaging code read the manifest rather than assuming a fixed question count or chunk list. The bank can therefore expand beyond 200 without rewriting gameplay code.

Questions 001–080 retain v2.2 workbook provenance. Questions 081–160 are the source-backed v2.3 expansion. Questions 161–200 are the v2.4 balancing expansion. New reviewed content should preserve its own version/provenance rather than rewriting historical record versions.

## Adding or editing questions

Use the dedicated content-maintenance CLI instead of manually hunting through chunk files.

```bash
# Show commands
npm run hiq:questions

# Create a ready-to-edit question template
npm run hiq:question-template -- /tmp/high-iq-question.json

# Find a question and the chunk that owns it
npm run hiq:questions -- get HIQ-S1-200

# Search question IDs, categories, difficulty, or question text
npm run hiq:questions -- list "Plant Biology"

# Promote one reviewed question into the canonical bank
npm run hiq:questions -- promote /tmp/high-iq-question.json

# Safely edit an existing question with a JSON patch
npm run hiq:questions -- edit HIQ-S1-200 /tmp/high-iq-patch.json

# Re-sync canonical data to the public runtime and validate
npm run hiq:questions -- sync
```

`promote` assigns the next ID when one is not supplied, creates/uses the appropriate versioned question chunk, updates manifest counts/distributions, copies changed data to the public runtime, synchronizes visible shell metadata, and runs validation. `edit` locates a question by ID so maintainers do not need to know which chunk owns it.

Promotion/edit rejects duplicate IDs or duplicate question text, missing A–D choices, invalid answer mappings, invalid difficulty/point combinations, missing explanations/context, unknown sources, and records that are not in the required Approved/PASS state.

## Manifest-driven shell and packaging

`games/high-iq/scripts/sync-runtime-shell.mjs` synchronizes the crawlable HTML shell from the manifest. Hero question count, topic count, source count, dataset version, approved-question copy, and the current gameplay-first stylesheet hook follow the release automatically.

`games/high-iq/scripts/validate-data.mjs` runs shell synchronization after dataset validation, so normal public-suite builds receive current visible metadata before packaging.

High IQ CI opens the generated WordPress game-route archive, reads the packaged manifest, and requires every question/source chunk declared by that manifest. This prevents future content expansion from being silently omitted by an old hand-maintained chunk list.

## UI/gameplay quality contract

The active question is the dominant play surface. Setup is treated as mode selection, the score/streak/accuracy HUD stays compact and sticky, answer choices remain large game-like targets, selected/correct/incorrect states are visually distinct, and lock/next controls stay reachable during play.

Desktop and mobile are both release gates. The browser test requires four answer targets, minimum 44 px answer/control heights, sticky gameplay HUD and controls, no horizontal overflow at 390×844, keyboard-safe source links, selected/correct state feedback, zero console/page errors, and a reduced-motion run.

The v3.3 layer is additive and must not duplicate A/B/C/D markers or move scoring/content logic into CSS/DOM presentation code.

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

For the real-browser gate:

```bash
npm ci
npx playwright install chromium
node games/high-iq/test/browser-smoke.mjs
```

The browser smoke test serves `site/public-route-patch` locally, loads the complete manifest-declared bank in Chromium, completes a five-question desktop challenge through results, verifies explanations/sources/history and keyboard behavior, then enters active gameplay at 390×844 with reduced-motion enabled and checks touch-target geometry, sticky controls, answer reveal state, overflow, and browser errors.

After deployment:

```bash
node games/high-iq/scripts/verify-live-v3.mjs
```

A DTF-hosted High IQ release requires canonical data validation, synchronized public data, authoring-tool tests, deterministic gameplay-core tests, runtime DOM/data contract checks, manifest-derived package verification, real Chromium desktop/mobile playthrough, and a passing post-deploy live verifier before the new release is recorded as production-verified.

See `game.json` for the machine-readable feature/integration contract and `data/manifest.json` for the controlled dataset contract.
