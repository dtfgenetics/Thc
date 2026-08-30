# DTF / THC game source index

Production target: **https://dtfseeds.com**

This directory contains game projects that are owned directly by the DTF master repository. Standalone game repositories remain canonical where the portfolio registry assigns them separately.

## Fast workflow

- Check the full ownership/route inventory: `npm run games:status`
- Before editing one game, resolve its exact owner and deploy contract: `npm run games:status -- --id <game-id>`
- Create a safe, non-deployable scaffold: `npm run games:new -- <game-id> "Game Title"`
- Verify the scaffold contract itself: `npm run games:scaffold-check`
- Verify game ownership, manifests, routes, source paths, deployment metadata, navigation, and release integrity: `npm run games:preflight`
- Architecture rules: `docs/GAME_ARCHITECTURE_STANDARD.md`
- Full workflow: `docs/GAME_DEVELOPMENT_WORKFLOW.md`

New game scaffolds are intentionally not published automatically. A game reaches dtfseeds.com only after its ownership, public runtime, deployment entry, tests, and PR checks are complete.

## Architecture for new local games

New schema-v2 scaffolds use the `dtf-browser-game-v1` contract:

- serializable simulation state and gameplay rules stay in `src/simulation/`
- browser/touch/controller bindings stay in `src/input.mjs`
- rendering stays in `src/render/`
- menus/HUD/settings/accessibility-sensitive UI stay in `src/ui/`
- stable asset keys live in `src/assets/manifest.json`
- machine-readable content stays in `data/`
- deterministic and integration tests stay in `test/`

Existing games remain supported regardless of older manifest schema shape. The stricter architecture checks are opt-in through the `dtf-browser-game-v1` marker emitted by the current scaffolder. Upgrade older games when meaningful game-specific work justifies the migration instead of doing a risky mass rewrite.

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
