# DTFSeeds Game Scope Master

## Standing development policy

`docs/GAME_DEVELOPMENT_FREEDOM.md` is the standing policy for DTFSeeds game work.

Prior scope language that discourages rebuilding shipped games, requires ownership to remain locked before implementation, treats existing architecture/repository placement as immutable, limits tools, or mandates preservation of an existing implementation is advisory only. Any game may be redesigned, rewritten, migrated, restructured, consolidated, split, renamed, or rebuilt as needed to achieve current user direction. Keep this ledger synchronized with the resulting reality rather than using stale scope text to block changes.

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

## Existing development projects

- **Ganjumanji: The Lost Grower’s Temple** — current dedicated-repository release candidate `0.3.0`, with its existing campaign, deterministic rules/storage, solvability validation, route-safe build, browser acceptance evidence, and production artifact. Its ownership, architecture, tooling, and promotion path may be changed if that better serves the product goal.
- **THC RPG** — current dedicated-repository release candidate `2.0.0` in `dtfgenetics/Thc-rpg`, with environment/equipment simulation, quests, deterministic phenotypes, persistent Pheno Grow Journal, Keeper systems, visitor build validation, browser acceptance evidence, and a production artifact. Its ownership, architecture, tooling, and promotion path may be changed if that better serves the product goal.

A title's current repository or release-candidate state describes where it is today; it does not lock future development.

## Formerly missing outlined slate — shipped

The ten titles that were previously tracked as missing now have tested browser implementations, self-hosted routes, public navigation entries, and deployment registration. They remain in this ledger so prior scope is not lost. Intentional redesigns and rebuilds are allowed.

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

Their current ownership/status is recorded in `data/project-registry.json`; visitor-facing routes are recorded in `data/public-navigation.json` and `site/deployment/public-apps.json`. Those mappings may be changed and then reconciled to the resulting architecture.

## Built prototype not yet promoted

- **Root Cause** — a tested browser vertical slice currently exists in this repository and currently remains outside the public Game Hub. It may be promoted, rebuilt, migrated, renamed, merged into another title, or otherwise changed when that serves current project direction. Public status must remain represented truthfully.

## Future concept bank

Earlier concepts retained as a secondary backlog include Pheno Hunter, Pest Patrol, Solo Cup Showdown, The Cure Room, Seed Bank Builder, Keeper or Compost, Grow Shop Hustle, Event Night, Find/Where’s Seed Man, Grow-Off, The Grow Room, Pest War, Line Builder, Selection Pressure, Pest Siege, Reputation Economy, The Limiting Factor, and The Perfect Save.

These are not automatically public production titles, but there is no ownership-lock or architecture-lock prerequisite before development. They may enter development whenever current user direction prioritizes them.

## Development sequence

There is no mandatory portfolio development order. Current user direction takes precedence. Existing source, mechanics, data, multiplayer systems, repositories, and deployment systems should be reused when they help and replaced when they do not.

Public games may be rebuilt before unfinished concepts, unfinished concepts may be promoted ahead of older release candidates, and shared systems may be consolidated across titles when that is the strongest product/engineering decision.

## Release integrity

A title should only be described as publicly playable after its actual visitor-facing route and runtime are verified. Deterministic tests, build checks, navigation/deployment metadata, and exact route verification should evolve with the architecture rather than being used to block legitimate redesigns.

Release integrity is evidence that the requested result reached production; it is not a restriction on how the game is designed or implemented.
