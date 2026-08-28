# Mystery Strain

Production target: **dtfseeds.com**

Mystery Strain is a solo deduction game. A hidden original game cultivar is selected from a fixed roster. The player spends a limited number of yes/no trait questions to narrow the candidate list, then guesses the hidden profile before running out of guesses.

## First playable vertical slice

- deterministic six-character case codes;
- 20 original fictional cultivar profiles so gameplay does not depend on disputed real-world strain claims;
- 12 binary trait questions covering aroma direction, structure, coloration, finish pace, and resin presentation;
- candidate elimination after every useful answer;
- eight standard questions and three guesses;
- optional Wild Card mode with a deterministic disclosed modifier;
- shareable challenge URL using the same case code and Wild Card setting;
- keyboard-safe DOM controls, responsive layout, and reduced-motion support;
- canonical data/engine copies synchronized with the self-hosted public runtime.

## Wild Card modifiers

- **Foggy Jar** — one question returns UNKNOWN and does not narrow the roster.
- **Extra Sniff** — one additional question is available.
- **Risky Read** — one fewer question, but one extra guess.

## Source of truth

- `data/strains.json` — canonical fictional roster and question definitions.
- `src/engine.mjs` — deterministic deduction rules.
- `scripts/validate-data.mjs` — roster/data and public-copy validation.
- `test/engine.test.mjs` — deterministic gameplay regression coverage.
- `site/public-route-patch/games/mystery-strain/` — self-hosted browser vertical slice.

## Current status

`browser-vertical-slice`. Production Hub registration, browser/mobile playtesting, accessibility review, final art direction, and production deployment remain separate release gates.
