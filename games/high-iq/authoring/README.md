# High IQ question authoring

High IQ is designed to keep growing without hand-editing runtime manifests or copying question files into the public route. The current release-candidate bank is v2.4 with 200 questions, but 200 is not a code ceiling.

## Fast workflow

1. Generate a fresh template:
   `node games/high-iq/scripts/question-bank.mjs template /tmp/high-iq-question.json`
2. Edit the JSON. Keep one correct answer and three believable same-topic distractors.
3. Verify every factual claim against one or more existing `SRC-###` records. Add a reviewed source to the source registry first if the claim is not adequately supported.
4. Promote the reviewed question:
   `node games/high-iq/scripts/question-bank.mjs promote /tmp/high-iq-question.json`
5. The tool assigns the next `HIQ-S1-###` ID when none is supplied, places the question into a versioned chunk, updates manifest totals/distributions, mirrors canonical data to the deployable public route, synchronizes visible shell metadata, and runs the strict dataset validator.

## Find or edit an existing question

Find by ID:
`node games/high-iq/scripts/question-bank.mjs get HIQ-S1-200`

Search by topic, difficulty, ID, or words from the question:
`node games/high-iq/scripts/question-bank.mjs list "root zone"`

Create a small JSON patch containing only fields you want to change, then run:
`node games/high-iq/scripts/question-bank.mjs edit HIQ-S1-200 /tmp/patch.json`

Nested `choices` are merged, so changing one distractor does not require rewriting all four choices. The tool preserves the question ID, revalidates answer mappings and sources, updates distributions when category/difficulty changes, mirrors the edited chunk to the public runtime, synchronizes the shell, and runs validation.

## Quality contract

A production question must:

- have A/B/C/D choices;
- map `correctLetter` exactly to `correctAnswer`;
- use 1/2/3/4 points for Easy/Medium/Hard/Expert;
- contain a useful explanation and wording/context note;
- cite at least one registered source that actually supports the claim;
- use `Approved` status and `PASS` audit before promotion;
- avoid duplicate IDs and duplicate question text;
- preserve historical record version/provenance when editing older approved content.

The browser should never be the canonical editor. Canonical content lives in `games/high-iq/data/`; `site/public-route-patch/games/high-iq/data/` is the mirrored deployment tree.

## Scaling rule

New content is stored in versioned chunks rather than one giant JavaScript file. The manifest tells the game, validators, shell sync, and packaging system which chunks exist, so future expansion does not require changing the gameplay loader.

Do not hard-code `200`, a final question ID, or a fixed chunk list into runtime/deployment code. A future v2.5/v3.x expansion should add reviewed records and let the authoring/manifest pipeline recalculate totals. Prefer manageable 20–40 question chunks rather than increasingly large monolithic files.

## Release rule

Content changes are not production changes until all gates pass. Before release run the High IQ data/runtime/authoring/core tests, real Chromium desktop and active-mobile playthrough, Public Suite qualification, WordPress deployment, and post-deploy live verification.

The mobile playtest must enter an actual question, not merely load the setup screen. Keep answer and primary control targets at least 44 px high, preserve keyboard operation, avoid horizontal overflow, and test with reduced motion enabled.
