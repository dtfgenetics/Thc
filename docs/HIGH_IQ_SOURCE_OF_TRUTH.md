# High IQ — Source of Truth

High IQ is the cannabis grower trivia game. It is **not** THC U Know.

## Canonical ownership

- Google Drive `04 Games/High IQ` is the current canonical project home for rules, question/answer masters, print layouts, answer keys, playtest records, and approved releases.
- ChatGPT Library `DTF Working Projects/02 Games/Cannabis trivia` is a working/recovery surface only.
- No canonical High IQ GitHub repository is assigned as of the 2026-08-15 consolidation audit.

## Locked content format

- Card face: category, difficulty, question, and A/B/C/D choices only.
- One correct answer and three believable distractors.
- Answer/explanation belongs in the separate answer system, not visibly on the card face.
- Difficulty levels: Easy, Medium, Hard, Expert.
- Avoid joke distractors that make the answer obvious.
- Existing audits and answer-quality reports in the Library are source material until reconciled into Drive.

## Repository rule

Do not put High IQ trivia data into `dtfgenetics/thc-u-know-card-game-`. THC U Know is a separate UNO-like multiplayer card game.

If High IQ receives a dedicated repository later, update `data/project-registry.json` and the master Repository Map before moving code/data.

## Release rule

Use the portfolio release criteria. A print/digital release must validate question IDs, answer-key alignment, duplicate questions, difficulty labels, card count/page layout, and final spelling/grammar.
