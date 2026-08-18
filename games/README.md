# DTF / THC game source index

This directory contains game projects that are owned directly by the DTF master repository. Standalone game repositories remain canonical where the portfolio registry assigns them separately.

## Source-controlled here

- `high-iq/` — High IQ integration/runtime metadata and website handoff.
- `bud-or-bluff/` — Bud or Bluff machine-ready research/game data.
- `high-life/` — branching three-era life-path game system.
- `strain-showdown/` — eight-family trading-card battle system.
- `grower-conversations/` — community conversation deck schema.
- `cannabis-fleet-battle/` — 15 × 15 multiplayer hidden-fleet strategy specification.
- `seed-man-platformer/` — original Seed Man browser-platformer specification.

## Standalone canonical repositories

High Land is implemented in `apps/high-land-web` in this repository. Weedopolis, THC U Know, THC Weekly Crossword, Kush Kings Chess, Who Took It?, Terpocalypse, PhenoQuest, and other assigned projects use their own repositories as recorded in `data/project-registry.json` and `site/deployment/public-apps.json`.

A project directory appearing here does not mean it is production-ready. Read each `game.json`/README status and release gates before deployment.
