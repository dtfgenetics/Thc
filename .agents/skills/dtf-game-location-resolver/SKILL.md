---
name: dtf-game-location-resolver
description: Resolve the exact DTF game repository, source paths, runtime path, public route, asset folders, aliases, migration copies, and production owner before any game work. Use for every DTF game task where location or ownership matters.
metadata:
  author: dtfgenetics
  version: "1.0.0"
---

# DTF Game Location Resolver

This skill is the durable location-memory layer for the DTF game portfolio.

## Mandatory first read

Read `data/game-location-registry.json` before editing a game. Resolve the user's name through `aliasMap` and then use the matching `games[]` entry.

Never infer authority from a same-named folder.

## Resolution order

1. Normalize the requested title/alias to lowercase.
2. Resolve it through `aliasMap`.
3. Read the canonical game entry.
4. If the task concerns the live game, use `production.repository` + `production.sourcePaths`.
5. If it concerns packaging/publication, also use `production.integrationPath`, `integrationMode`, public route, and deployment status.
6. If it concerns assets, use the location entry's asset registry ID and then `data/game-asset-production-registry.json` / the ingest location registry.
7. Use `developmentLocations` only for explicit migration/prototype work or when implementing a documented cutover.
8. Treat locations marked archived, prototype, migration, compatibility, or do-not-confuse-with-production as non-authoritative until ownership changes.
9. When a location changes, update the registry and its validator in the same work.

## Required answer before implementation

Internally establish:
- canonical game ID;
- aliases used;
- production repository;
- canonical source path(s);
- integration/runtime path;
- public route;
- development/migration copies;
- asset registry mapping;
- release/build lane.

If any of these materially conflict, resolve the conflict before changing code.

## Special cases

- **Burn Buds** resolves to `protect-the-plants`: production source `dtfgenetics/Thc/games/protect-the-plants`, runtime `site/public-route-patch/games/protect-the-plants`. `games/cannabis-fleet-battle` is legacy history and `dtfgenetics/Dtf420/game/burn-buds` is a prototype/migration copy.
- **Seed Man** resolves to `seed-man-platformer` for current production.
- **Seed Ascent** resolves separately to `seed-ascent` and currently lives only in Dtf420 as a development/migration runtime; do not silently redirect Seed Ascent work into production Seed Man.
- **Weedopolis**, **Who Took It?**, **Crossword**, **PhenoQuest**, **THC RPG**, **Kush Kings**, and other standalone-repo games must be edited in their recorded canonical owner for production behavior.
- **Stoner Duck Race** is currently active development in Dtf420 and requires an explicit production-owner mapping before a live-release claim.

## Verification

Run:
`npm run games:locations:check`

A new game is not fully registered until its canonical source, route/status, aliases, development copies, and asset mapping are represented where applicable.
