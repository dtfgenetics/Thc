# High IQ — Source of Truth

High IQ is the cannabis grower trivia game. It is **not** THC U Know.

## Canonical ownership

- Google Drive `04 Games/High IQ` remains canonical for approved rules, print layouts, answer keys, playtest records, and approved print/release packages.
- `dtfgenetics/Thc` is the canonical GitHub source for the self-hosted browser implementation, machine-readable runtime data, validators, website integration, and deployment records under `games/high-iq/` and `site/public-route-patch/games/high-iq/`.
- The production browser route is `/games/high-iq/` and is packaged directly into the DTFSeeds public application suite.
- The older Base44 build is retained only as a legacy fallback link; it is no longer the canonical runtime.
- ChatGPT Library `DTF Working Projects/02 Games/Cannabis trivia` is a working/recovery surface only.

## Current production implementation

- Self-hosted HTML/CSS/JavaScript browser game under `site/public-route-patch/games/high-iq/`.
- Versioned v2.2 machine-readable question/source bank under `games/high-iq/data/` and the deployable route data directory.
- 80 validated production questions with category and difficulty filtering.
- Difficulty-weighted scoring: Easy 1, Medium 2, Hard 3, Expert 4.
- Answer explanations, context notes, and visible verification-source records after an answer is locked.
- Keyboard answer selection and responsive browser controls.
- Canonical URL: `https://dtfseeds.com/games/high-iq/`.

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

## Release rule

A print/digital release must validate question IDs, answer-key alignment, duplicate questions, difficulty labels, source references, final spelling/grammar, and the exact runtime/deployment status presented to visitors. The self-hosted route may be called production-ready only when it is included in the validated public-suite artifact; it may be called live only after the DTFSeeds production audit confirms the route is serving the packaged build.
