# Grow Room Bingo / Bongwater Bingo

Production target: **dtfseeds.com**

A community/event bingo game for DTF Genetics. The first browser build creates reproducible 5×5 cards from a shareable card code, with a FREE center square and automatic row/column/diagonal bingo detection.

## Modes

- **Grow Room Bingo** — cultivation and grow-community moments.
- **Bongwater Bingo** — lighter sesh/event moments for community nights.
- **Mixed Garden** — combines both prompt pools.

## First playable vertical slice

- deterministic card generation from a six-character share code;
- 5×5 board with FREE center;
- mark/unmark squares;
- automatic bingo-line highlighting and line count;
- new random card and exact-code replay;
- copy/share card code;
- local best line count per mode;
- responsive button grid and reduced-motion support.

## Source of truth

- `data/prompts.json` — canonical prompt pool.
- `scripts/validate-data.mjs` — validates prompt uniqueness, mode coverage, and public-data synchronization.
- `site/public-route-patch/games/grow-room-bingo/` — self-hosted browser vertical slice.

## Current status

`browser-vertical-slice`. Production Hub/deployment registration, event playtesting, final art direction, and broader prompt expansion remain open gates.
