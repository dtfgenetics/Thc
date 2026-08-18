# High IQ — Source of Truth

High IQ is the cannabis grower trivia game. It is **not** THC U Know.

## Canonical ownership

- Google Drive `04 Games/High IQ` remains canonical for approved rules, question/answer masters, print layouts, answer keys, playtest records, and approved release packages.
- `dtfgenetics/Thc` is now the canonical GitHub integration repository for the public High IQ landing route, machine-readable runtime metadata, and migration/deployment records under `games/high-iq/`.
- The current playable browser runtime is an external Base44 build recorded in `games/high-iq/game.json`; it is not represented as self-hosted source code.
- ChatGPT Library `DTF Working Projects/02 Games/Cannabis trivia` is a working/recovery surface only.

## Locked content format

- Card face: category, difficulty, question, and A/B/C/D choices only.
- One correct answer and three believable distractors.
- Answer/explanation belongs in the separate answer system, not visibly on the card face.
- Difficulty levels: Easy, Medium, Hard, Expert.
- Avoid joke distractors that make the answer obvious.
- Existing audits and answer-quality reports in the Library are source material until reconciled into Drive.

## Repository rule

Do not put High IQ trivia data into `dtfgenetics/thc-u-know-card-game-`. THC U Know is a separate multiplayer card game.

Use `games/high-iq/` in `dtfgenetics/Thc` for website integration metadata and the branded DTFSeeds landing route until the actual browser source is exported or connected. If self-hosted High IQ source becomes available, migrate it into a dedicated application directory such as `apps/high-iq-web/`, validate feature parity, and only then replace the external runtime dependency.

## Release rule

Use the portfolio release criteria. A print/digital release must validate question IDs, answer-key alignment, duplicate questions, difficulty labels, card count/page layout, final spelling/grammar, and the exact runtime/deployment status presented to visitors.
