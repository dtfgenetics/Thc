# Grower Conversations

**Grower Conversations** is a community conversation-starter deck for growers and plant-science learners. The goal is discussion, reflection, knowledge-sharing, and community engagement—not trivia scoring.

This directory is the GitHub source-of-truth for the canonical prompt bank, category definitions, digital deck logic, Drive provenance, deduplication, and release validation. Approved printable art and final production exports remain release-controlled assets.

## Design principles

- Questions should invite meaningful discussion rather than yes/no answers.
- Separate personal-experience prompts from factual plant-science prompts.
- Avoid encouraging unsafe, illegal, or label-violating practices.
- Prompts should work in person, on Discord, or in a browser deck.
- Every card needs a stable ID so printed and digital editions remain synchronized.
- Prompts should feel like real grower conversations, not generic party-card filler.
- Hot-take/debate prompts should invite discussion without attacking players.
- The deck should mix approachable openers, reflective prompts, and deeper technical/breeder discussion.

## Current machine state

- `data/prompt-bank.json` contains the canonical 96-card prompt bank.
- `data/categories.json` controls the current category system.
- The browser deck is packaged at `site/public-route-patch/games/grower-conversations/`.
- The browser runtime supports category/depth filtering and no-repeat draws until the active filtered pool is exhausted.
- `data/drive-prompt-starter-source.json` preserves the original three-row Drive starter and editorial rules as provenance; it must not overwrite the completed prompt bank.

## Current status

`browser-deck-alpha` — 96 prompts and the self-hosted browser deck are implemented and validated. Remaining gates are human editorial/playtest review, final visual system, print layout/backs/packaging, and release QA.
