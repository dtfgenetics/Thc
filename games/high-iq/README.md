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
npm run hiq:questions
npm run hiq:question-template -- /tmp/high-iq-question.json
npm run hiq:questions -- get HIQ-S1-200
npm run hiq:questions -- list "Plant Biology"
npm run hiq:questions -- promote /tmp/high-iq-question.json
npm run hiq:questions -- edit HIQ-S1-200 /tmp/high-iq-patch.json
npm run hiq:questions -- sync
```

`promote` assigns the next ID when one is not supplied, creates or uses the appropriate versioned question chunk, updates manifest counts/distributions, copies changed data to the public runtime, synchronizes visible shell metadata, and runs validation. `edit` locates a question by ID so maintainers do not need to know which chunk owns it.

Promotion/edit rejects duplicate IDs or duplicate question text, missing A–D choices, invalid answer mappings, invalid difficulty/point combinations, missing explanations/context, unknown sources, and records that are not in the required Approved/PASS state.

## Manifest-driven shell and packaging

`games/high-iq/scripts/sync-runtime-shell.mjs` synchronizes the crawlable HTML shell from the manifest. Hero question count, topic count, source count, dataset version, approved-question copy, and the current gameplay-first stylesheet hook follow the release automatically.

`games/high-iq/scripts/sync-deployment-registry.mjs` keeps the public application registry aligned to the same manifest. `.github/workflows/reconcile-high-iq-manifest.yml` runs both synchronizers on `main`, validates that the result is idempotent, verifies the v2.4/200-question contract, and safely integrates generated shell/registry changes through the repository integration helper.

High IQ packaging must read the generated manifest and include every declared question/source chunk. Future content expansion must not depend on an old hand-maintained chunk list or hard-coded question count.

## UI/gameplay quality contract

The active question is the dominant play surface. Setup is treated as mode selection, the score/streak/accuracy HUD stays compact and sticky, answer choices remain large game-like targets, selected/correct/incorrect states are visually distinct, and lock/next controls stay reachable during play.

Desktop and mobile presentation must preserve readable answer targets, keyboard-safe source links, selected/correct state feedback, reduced-motion compatibility, and no horizontal overflow. Routine repository validation uses deterministic DOM/data/runtime checks and live-route verification rather than Playwright.

The v3.3 layer is additive and must not duplicate A/B/C/D markers or move scoring/content logic into CSS/DOM presentation code.

## Tests and production gates

Run the primary checks before promotion:

```bash
npm run hiq:validate
node games/high-iq/test/question-bank-tool.test.mjs
node games/high-iq/test/game-core.test.mjs
node games/high-iq/test/runtime-smoke.mjs
```

The broader validation stack includes:

```bash
node games/high-iq/scripts/validate-data.mjs
node games/high-iq/scripts/sync-runtime-shell.mjs --check
node games/high-iq/scripts/sync-deployment-registry.mjs --check
node games/high-iq/scripts/validate-public-runtime.mjs
node games/high-iq/test/question-bank-tool.test.mjs
node games/high-iq/test/game-core.test.mjs
node games/high-iq/test/runtime-smoke.mjs
node --check site/public-route-patch/games/high-iq/app-v3.js
node --check site/public-route-patch/games/high-iq/game-core.mjs
node --check games/high-iq/scripts/question-bank.mjs
node --check games/high-iq/scripts/sync-runtime-shell.mjs
node --check games/high-iq/scripts/sync-deployment-registry.mjs
node --check games/high-iq/scripts/verify-live-v3.mjs
```

After deployment:

```bash
node games/high-iq/scripts/verify-live-v3.mjs
```

A DTF-hosted High IQ release requires canonical data validation, synchronized public data, authoring-tool tests, deterministic gameplay-core tests, runtime DOM/data contract checks, manifest-derived package verification, and a passing post-deploy live verifier before the new release is recorded as production-verified.

See `game.json` for the machine-readable feature/integration contract and `data/manifest.json` for the controlled dataset contract.
