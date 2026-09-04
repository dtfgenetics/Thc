# High IQ question authoring

High IQ is designed to keep growing without hand-editing runtime manifests or copying question files into the public route.

## Fast workflow

1. Generate a fresh template:
   `node games/high-iq/scripts/question-bank.mjs template /tmp/high-iq-question.json`
2. Edit the JSON. Keep one correct answer and three believable same-topic distractors.
3. Verify every factual claim against one or more existing `SRC-###` records. Add a new source to the source registry first if needed.
4. Promote the reviewed question:
   `node games/high-iq/scripts/question-bank.mjs promote /tmp/high-iq-question.json`
5. The tool assigns the next `HIQ-S1-###` ID when none is supplied, places the question into a versioned chunk, updates manifest totals/distributions, mirrors canonical data to the deployable public route, and runs the strict dataset validator.

## Find or edit an existing question

Find by ID:
`node games/high-iq/scripts/question-bank.mjs get HIQ-S1-123`

Search by topic, difficulty, ID, or words from the question:
`node games/high-iq/scripts/question-bank.mjs list "root zone"`

Create a small JSON patch containing only fields you want to change, then run:
`node games/high-iq/scripts/question-bank.mjs edit HIQ-S1-123 /tmp/patch.json`

Nested `choices` are merged, so changing one distractor does not require rewriting all four choices. The tool preserves the question ID, revalidates answer mappings and sources, updates distributions when category/difficulty changes, mirrors the edited chunk to the public runtime, and runs validation.

## Quality contract

A production question must:

- have A/B/C/D choices;
- map `correctLetter` exactly to `correctAnswer`;
- use 1/2/3/4 points for Easy/Medium/Hard/Expert;
- contain a useful explanation and wording/context note;
- cite at least one registered source;
- use `Approved` status and `PASS` audit before promotion;
- avoid duplicate IDs and duplicate question text.

The browser should never be the canonical editor. Canonical content lives in `games/high-iq/data/`; `site/public-route-patch/games/high-iq/data/` is generated/mirrored deployment data.

## Scaling rule

New content is stored in versioned chunks rather than one giant JavaScript file. The manifest tells the game which chunks exist, so future expansion does not require changing the gameplay loader. New post-160 chunks default to 20-question ranges such as `questions-161-180.v2.3.json`.

Before release, run the existing High IQ data, runtime, gameplay-core, browser, and live verification gates.
