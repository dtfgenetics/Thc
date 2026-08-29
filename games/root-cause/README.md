# Root Cause

Root Cause is a deterministic cultivation-diagnostics deduction game for the DTF Games catalog.

## First playable loop

- Six cases per run, selected deterministically from a twelve-case bank.
- Each case starts with visible symptoms and environmental context.
- The player may run up to two inspections before diagnosing.
- Four plausible diagnoses are presented in deterministic order.
- A correct first diagnosis scores highest; inspections and wrong guesses reduce the available score.
- Two incorrect diagnoses end the case and reveal the root cause.
- A six-character case code reproduces the same case order and answer order for replay or sharing.

## Education boundary

The game teaches observation, differential diagnosis, and broad cultivation concepts. It does not provide pesticide recipes, mixing rates, medical advice, or laboratory certainty. Real plants can show overlapping symptoms, so players are encouraged to verify conditions before acting.

## Source of truth

- Data: `games/root-cause/data/cases.json`
- Engine: `games/root-cause/src/engine.mjs`
- Tests: `games/root-cause/test/engine.test.mjs`
- Validator: `games/root-cause/scripts/validate-data.mjs`
- Public route: `site/public-route-patch/games/root-cause/`
