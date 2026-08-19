# High Life

**High Life: From Bagseed to Legacy** is an original cannabis-industry life-path board game with a tested deterministic browser prototype.

This directory is the GitHub source-of-truth for machine-readable rules, event data, deterministic simulation, balance tests, digital prototypes, validation, and implementation notes. Approved art, print masters, proofs, and release packages remain outside code storage until cleared for release.

## Locked structure

- Three historical/gameplay eras: **Underground → Medical → Legal**.
- Players progress through career decisions and changing era conditions rather than a circular property board.
- Core resources are reputation, cash, knowledge, assets, compliance, brand, operations, and genetics.
- Every turn resolves one player action and one seeded era event.
- A complete prototype career lasts 18 turns: six turns in each era.
- Era transitions evaluate preparation gates and apply a small transition bonus or penalty.
- Legacy scoring rewards total progress while also giving a balance bonus for building across multiple systems.
- The visual identity, written rules, cards, economy, board geometry, terminology, and components must remain independently designed.

## Implemented source

- `src/engine.mjs` — deterministic game state, legal actions, era transitions, event resolution, simulation, and Legacy scoring.
- `data/events.json` — 18 current prototype events, six per era.
- `data/eras.json` — era design intent and thematic boundaries.
- `test/engine.test.mjs` — deterministic regression tests plus multi-seed balance simulation.
- `site/public-route-patch/games/high-life/` — self-hosted browser prototype packaged by the DTFSeeds public-suite workflow.

## Balance guard

The current CI simulation runs four deliberately different strategy cycles across 120 seeds each. The first implementation averaged roughly 220–229 Legacy points across those profiles, an average spread of about 9.1 points. CI fails if that spread grows above 38 points.

This is a regression guard, not a claim that final balance is solved. Human playtesting is still required before locking the economy or print rules.

## Current status

`browser-prototype` — the deterministic rules engine, event system, seeded simulations, browser route, and CI gates exist. Human browser playtesting, richer branch/path presentation, final art, accessibility review, print-layout review, and final economy approval are still open gates.

## Next implementation gate

Run human playtests on the browser prototype, collect decision/score distributions, then use those results to refine branch choices and event/economy values before producing final board geometry or print components.
