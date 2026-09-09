# High IQ — Source of Truth

High IQ is the cannabis grower trivia game. It is **not** THC U Know.

## Canonical ownership

- Google Drive `04 Games/High IQ` remains canonical for approved rules, print layouts, answer keys, playtest records, and approved print/release packages.
- `dtfgenetics/Thc` is the canonical GitHub source for the self-hosted browser implementation, machine-readable runtime data, validators, website integration, and deployment records under `games/high-iq/` and `site/public-route-patch/games/high-iq/`.
- The production browser route is `/games/high-iq/` and is packaged directly into the DTFSeeds public application suite.
- The older Base44 build is retained only as a legacy fallback link; it is no longer the canonical runtime.
- ChatGPT Library `DTF Working Projects/02 Games/Cannabis trivia` is a working/recovery surface only.

## Controlled Drive provenance

The approved v2.2 Drive production package remains registered in `games/high-iq/data/drive-production-artifacts.json` as the controlled human-production provenance for questions `HIQ-S1-001` through `HIQ-S1-080`:

- `High_IQ_Master_Production_Workbook_v2_2.xlsx` — Drive ID `1fERIAH253LT__Jy8AWzjfZTOhhckWLOH`.
  - 80-card verified deck.
  - Deck status `READY` in the workbook.
  - 80 approved cards.
  - 0 validation errors and 0 validation warnings in the workbook control sheet.
  - Correct-answer distribution is 20 A / 20 B / 20 C / 20 D.
  - Category totals: Plant Biology 8, Plant Physiology 8, Photobiology 8, Environment & Climate 10, Nutrition & pH 12, Root Zone & Irrigation 10, Diagnostics 8, Integrated Pest Management 6, Genetics & Breeding 6, Harvest & Postharvest 4.
- `High_IQ_Duplex_Print_20pages_v2_2.pdf` — Drive ID `1qYimYjXytowm0YaO72ETlx_LmzDmuRJ5`.
  - Controlled duplex print artifact; the binary remains in Drive rather than being duplicated into the public code repository.

The v2.2 workbook is provenance, not the current browser question-count ceiling. GitHub-owned source-backed expansions preserve their own record versions instead of rewriting the historical workbook record.

## Current browser release candidate

- Dataset version: **v2.4**.
- Approved/PASS questions: **200**.
- Registered sources: **50**.
- Topic domains: **10**.
- Difficulty levels: Easy, Medium, Hard, Expert.
- Question range: `HIQ-S1-001` through `HIQ-S1-200`.
- Questions `001–080` retain v2.2 workbook provenance.
- Questions `081–160` are the source-backed v2.3 expansion.
- Questions `161–200` are the v2.4 balancing expansion.
- Canonical dataset contract: `games/high-iq/data/manifest.json`.
- Canonical machine-readable question/source chunks: `games/high-iq/data/`.
- Deployable browser runtime: `site/public-route-patch/games/high-iq/`.
- Canonical URL: `https://dtfseeds.com/games/high-iq/`.

The browser runtime reads the manifest-declared chunk lists rather than assuming a fixed question count, so future reviewed expansions can be added without rewriting gameplay code.

## Current production implementation

- Self-hosted HTML/CSS/JavaScript browser game under `site/public-route-patch/games/high-iq/`.
- Manifest-driven v2.4 machine-readable question/source bank under `games/high-iq/data/` with a synchronized deployable data mirror.
- Balanced Mix and Random Mix sessions plus deterministic Daily 10.
- Variable session lengths and category/difficulty filtering.
- Difficulty-weighted scoring: Easy 1, Medium 2, Hard 3, Expert 4.
- Live accuracy and streak tracking.
- Answer explanations, context notes, and visible verification-source records after an answer is locked.
- Missed-question review and practice-missed reruns.
- Local run history and personal bests.
- Sharing and topic/source coverage views.
- Keyboard controls, reduced-motion support, forced-colors support, and explicit data-retry diagnostics.

## Locked content format

- Card/question face: category, difficulty, question, and A/B/C/D choices only before an answer is locked.
- One correct answer and three believable distractors.
- Explanation and answer verification appear only after the answer is locked.
- Difficulty levels: Easy, Medium, Hard, Expert.
- Avoid joke distractors that make the answer obvious.
- Existing audits and answer-quality reports in the Library are source material until reconciled into Drive or GitHub.

## Repository rule

Do not put High IQ trivia data into `dtfgenetics/thc-u-know-card-game-`. THC U Know is a separate multiplayer card game.

Use `games/high-iq/` for canonical machine-readable data and validation, and `site/public-route-patch/games/high-iq/` for the deployable self-hosted browser runtime. Any future dedicated app directory must preserve feature parity and pass the same data validation before replacing this route.

`dtfgenetics/Dtf420` may contain a development or migration implementation, but it is not allowed to replace the canonical DTFSeeds High IQ route with a smaller or older bank. Any migration must first reconcile the complete manifest-declared production dataset, sources, Daily 10 behavior, scoring, missed-question review, history, accessibility, and validation contract.

## Release rule

A print/digital release must validate question IDs, answer-key alignment, duplicate questions, difficulty labels, source references, final spelling/grammar, and the exact runtime/deployment status presented to visitors. The self-hosted route may be called production-ready only when it is included in the validated public-suite artifact; it may be called live only after the DTFSeeds production audit confirms the route is serving the packaged build.
