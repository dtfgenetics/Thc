# DTFSeeds Game Scope Master

Production target: **https://dtfseeds.com/games/**

This file is the durable scope ledger for DTF Genetics games. A title should not disappear from planning simply because it is not yet on the public Game Hub. Public-count claims in this file must stay synchronized with `data/public-navigation.json` and the Game Hub deployment marker.

## Public playable catalog

The current Game Hub exposes 25 playable browser games:

1. High IQ — Test Higher Cognition
2. High Life: From Bagseed to Legacy
3. Seed Man: Sprout Run
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

- **Ganjumanji: The Lost Grower’s Temple** — dedicated repository; keep gated until its own approved playable implementation is ready.
- **THC RPG** — dedicated project; do not replace it with a competing implementation inside this repository.

## Formerly missing outlined slate — shipped

The ten titles that were previously tracked as missing now have canonical tested browser implementations, self-hosted routes, public navigation entries, and deployment registration. They remain in this ledger so prior scope is not lost or accidentally rebuilt:

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

Their canonical ownership/status is recorded in `data/project-registry.json`; their visitor-facing routes are recorded in `data/public-navigation.json` and `site/deployment/public-apps.json`.

## Built prototype not yet promoted

- **Root Cause** — a tested browser vertical slice exists in this repository, but it remains outside the public Game Hub because it originated in the secondary concept bank. Promotion requires a deliberate public-scope decision plus the normal release checks; do not silently add it just because an implementation exists.

## Future concept bank

These earlier concepts are preserved as a secondary backlog rather than silently lost: Pheno Hunter, Pest Patrol, Solo Cup Showdown, The Cure Room, Seed Bank Builder, Keeper or Compost, Grow Shop Hustle, Event Night, Find/Where’s Seed Man, Grow-Off, The Grow Room, Pest War, Line Builder, Selection Pressure, Pest Siege, Reputation Economy, The Limiting Factor, and The Perfect Save.

These are not automatically approved production titles. Promote them into controlled development only after mechanics and ownership are locked.

## Next development sequence

Priority now favors unfinished controlled projects and quality/completeness work rather than rebuilding games that already shipped:

1. Audit and advance **Ganjumanji** in its dedicated canonical repository.
2. Audit and advance **THC RPG** in its dedicated canonical repository.
3. Review **Root Cause** for public promotion only after its quality, ownership, and release gates are rechecked.
4. Continue quality, mobile, accessibility, balance, art, and multiplayer upgrades for the 25 public titles.
5. Promote future concept-bank titles only after scope, mechanics, and canonical ownership are explicitly established.

## Release rule

A game is only promoted to the public playable count after it has:

- a canonical source location;
- deterministic rules/data validation where applicable;
- a self-hosted visitor-facing route;
- keyboard/mobile-safe interaction appropriate to the game;
- truthful metadata and release status;
- packaging/deployment registration;
- production route verification after deployment.
