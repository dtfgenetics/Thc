# Strain Match

Production target: **dtfseeds.com**

Strain Match is an educational memory game built from the previously outlined DTF concept: match cannabis/cultivation terms to the correct family, terpene association, symptom, breeding concept, or tool use.

## First playable vertical slice

The browser build contains four 4×4 decks. Each deck has eight concept pairs and sixteen cards:

- Terpene Signals
- Plant Problem Clues
- Seeds & Breeding
- Grow Tools

Players reveal two cards at a time. A term matches its paired clue. Correct pairs stay face-up and reveal a short educational note. The round ends when all eight pairs are solved.

## Scoring

- `Moves` counts every two-card attempt.
- `Time` starts on the first reveal and stops on the final match.
- Best move count and best time are stored locally per deck.
- No account, network service, or server persistence is required.

## Source of truth

- `data/decks.json` — canonical educational pair data.
- `scripts/validate-data.mjs` — deterministic data/public-sync validation.
- `game.json` — implementation and release contract.
- `site/public-route-patch/games/strain-match/` — self-hosted browser vertical slice.

## Current status

`browser-vertical-slice` — core rules, four decks, responsive browser UI, keyboard-operable card buttons, local best scores, and deterministic validation are implemented. Human educational review, broader deck expansion, final illustration/art direction, cross-device playtest, and production deployment registration remain open gates.
