# DTFSeeds Game Scope Master

## TEMPORARY USER OVERRIDE — GAME RESTRICTIONS ON HOLD

`docs/GAME_RESTRICTIONS_HOLD.md` is currently **ACTIVE**. Until the user explicitly revokes it, prior scope language in this file that discourages rebuilding shipped games, requires ownership to remain locked before implementation, or treats existing architecture/repository placement as immutable is advisory only. Any game may be redesigned, rewritten, migrated, restructured, or consolidated as needed to achieve the current user-directed rebuild. Keep this ledger synchronized with the resulting reality rather than using stale scope text to block changes.

Production target: **https://dtfseeds.com/games/**

This file is the durable scope ledger for DTF Genetics games. A title should not disappear from planning simply because it is not yet on the public Game Hub. Public-count claims in this file must stay synchronized with `data/public-navigation.json` and the Game Hub deployment marker.

## Public playable catalog

The current Game Hub exposes 25 playable browser games:

1. High IQ — Test Higher Cognition
2. High Life: From Bagseed to Legacy
3. Seed Man: Grow. Fight. Restore.
4. Grower Conversations
5. High Land: The Sweet Escape
6. Weedopolis: Strain City Edition
7. Strain Showdown
8. THC Weekly Crossword
9. Who Took It?
10. Burn Buds
11. Bud or Bluff
12. THC U Know
13. Kush Kings Chess
14. Terpocalypse: Grow Room From Hell
15. PhenoQuest: The Living Seed Vault
16. Strain Match
17. Grow Room Bingo / Bongwater Bingo
18. Lost in the Terps
19. Mystery Strain
20. Spin the Strain
21. Grow Room Defense
22. Harvest Hustle
23. Trichome Trials
24. Pheno Draft
25. High Lines

## Existing controlled development projects

- **Ganjumanji: The Lost Grower’s Temple** — canonical release candidate `0.3.0` in its dedicated repository. The three-region campaign, deterministic rules/storage, campaign solvability validation, route-safe build, desktop/mobile Playwright acceptance, screenshot evidence, and production artifact are green at revision `e82580daa684fc7733ef6cfcb12a502939a609dd`. It stays outside the public playable count until DTFSeeds packaging and exact live-route verification pass.
- **THC RPG** — canonical release candidate `2.0.0` in `dtfgenetics/Thc-rpg`, pinned at merged revision `15fe22d69afaee906714a1ad0933505e437202dd`. Environment/equipment simulation, quests, deterministic phenotypes, persistent Pheno Grow Journal, Keeper selection, Keeper cutting/replanting, visitor-only build validation, desktop/mobile Chromium acceptance, and artifact `thc-rpg-production-build` are green. It stays outside the public playable count until central DTFSeeds packaging and exact live-route verification pass.

## Formerly missing outlined slate — shipped

The ten titles that were previously tracked as missing now have canonical tested browser implementations, self-hosted routes, public navigation entries, and deployment registration. They remain in this ledger so prior scope is not lost or accidentally rebuilt under the old policy. During the active temporary restriction hold, intentional rebuilds are allowed.

1. **Strain Match** — educational memory/matching game.
2. **Grow Room Bingo / Bongwater Bingo** — event/community bingo.
3. **Lost in the Terps** — themed word-search missions.
4. **Spin the Strain** — wheel-driven strain/trivia/challenge selector.
5. **Mystery Strain** — yes/no strain-trait deduction game.
6. **High Lines** — interactive cannabis coloring/activity experience.
7. **Grow Room Defense** — IPM defense game using correct counterplay.
8. **Harvest Hustle** — time-management harvest/trim arcade game.
9. **Pheno Draft** — genetics deck-builder centered on selection and breeding decisions.
10. **Trichome Trials** — structured judging/scorecard game.

Their current ownership/status is recorded in `data/project-registry.json`; their visitor-facing routes are recorded in `data/public-navigation.json` and `site/deployment/public-apps.json`. These mappings may be changed during the active hold and must then be reconciled to the new architecture.

## Built prototype not yet promoted

- **Root Cause** — a tested browser vertical slice exists in this repository, but it remains outside the public Game Hub because it originated in the secondary concept bank. During the temporary hold it may be promoted, rebuilt, migrated, or otherwise changed if that serves the current project goal; public status must still be represented truthfully.

## Future concept bank

These earlier concepts are preserved as a secondary backlog rather than silently lost: Pheno Hunter, Pest Patrol, Solo Cup Showdown, The Cure Room, Seed Bank Builder, Keeper or Compost, Grow Shop Hustle, Event Night, Find/Where’s Seed Man, Grow-Off, The Grow Room, Pest War, Line Builder, Selection Pressure, Pest Siege, Reputation Economy, The Limiting Factor, and The Perfect Save.

These are not automatically public production titles. During the active hold they may enter development without the former ownership-lock prerequisite when the user directs it, but deployment status must remain accurate.

## Current development sequence during the restriction hold

The previous sequence that favored finishing existing release candidates before rebuilding public titles is suspended. Current user direction takes precedence: the portfolio may be redesigned or rebuilt in whatever order best advances the requested game-quality overhaul. Existing source, mechanics, data, multiplayer, and deployment systems should be reused only when they help; they are not mandatory constraints.

## Release integrity

Even during the restriction hold, a title should only be described as publicly playable after its actual visitor-facing route and runtime are verified. Deterministic tests, build checks, navigation/deployment metadata, and exact route verification should be updated to fit the resulting architecture rather than used to block legitimate redesigns.
