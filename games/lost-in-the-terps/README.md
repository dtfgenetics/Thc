# Lost in the Terps

Production target: **dtfseeds.com**

Lost in the Terps is a cannabis/cultivation word-search game built from the recovered DTF game scope.

## First playable vertical slice

Three missions are included:

- **Terp Jungle** — common terpene/aroma vocabulary.
- **Grow Room Panic** — cultivation environment and monitoring vocabulary.
- **Gas Station Sesh** — gas, spice, resin, and lineage-themed vocabulary.

Players select the first and last letter of a hidden straight-line word. Correct selections stay highlighted and are checked off. Reverse selections are accepted. A mission ends when all eight words are found.

## Source of truth

- `data/puzzles.json` — canonical grids, word lists, and exact solution coordinates.
- `scripts/validate-data.mjs` — verifies grid dimensions, coordinate bounds, and every stored word against the grid.
- `site/public-route-patch/games/lost-in-the-terps/` — browser vertical slice.

## Current status

`browser-vertical-slice`. Production deployment registration, expanded missions, final illustration/art direction, mobile playtesting, and accessibility review remain open release gates.
