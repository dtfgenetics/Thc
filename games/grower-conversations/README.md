# Grow Room Confessions

**Grow Room Confessions** is a social conversation game for cultivators, breeders, and growers who have stories. It is separate from High IQ and is not a trivia game: cards are designed to trigger stories, debate, reflection, grow-room psychology, strain talk, and group interaction rather than produce scored factual answers.

The existing public route remains `/games/grower-conversations/` for compatibility. The internal project ID and source directory also remain `grower-conversations`.

## Source of truth

- `PRODUCTION_SPEC.md` is the authoritative product definition.
- `data/prompt-bank.json` is the current 96-card **digital-preview** prompt bank.
- `data/categories.json` controls the current preview category system.
- `site/public-route-patch/games/grower-conversations/` contains the self-hosted browser implementation.
- `data/drive-prompt-starter-source.json` preserves historical starter material and must never overwrite the canonical bank.

## Locked product rules

- Physical first-edition target: **200 prompt cards**.
- Internal stable IDs are required for synchronization and QA.
- Internal IDs, serial numbers, page numbers, and card numbers **must never be visible on card faces**.
- Final public lanes: Confessions, Hot Takes, Would You Rather, Grow Room Debates, Grower Psychology, Call Your Shot, Strain Talk, Wild Cards.
- Signature interaction: **Go Deeper**, **Call It Out**, **Respect**.
- Keeper scoring is optional and social, never a claim of scientific correctness.
- Six supported modes: Smoke Circle, Grower’s Court, Deep Roots, Hotbox Debate, Chaos Grow, Solo Grow Journal.

## Current implementation state

The browser build contains 96 validated prompts and is now treated as a digital preview while the production bank and full social-game mechanics are being completed.

Implemented:
- category/depth filtering;
- no-repeat draws within the active filtered pool;
- local session persistence;
- prompt copy;
- keyboard shortcuts;
- accessibility support;
- Grow Room Confessions public branding;
- no visible internal card IDs.

Still required for production:
- migrate from the educational preview taxonomy to the eight locked social-game lanes;
- expand the canonical prompt bank to 200 QA-clean cards;
- add intensity metadata;
- add mode presets;
- add Keeper tracking;
- add the three interaction-token controls;
- finish the premium tabletop visual rebuild;
- create print fronts/backs, support cards, tokens, box art, imposition, and final proof;
- complete editorial, safety, deterministic validation, and playtest review.

See `PRODUCTION_SPEC.md` for the complete release contract.
