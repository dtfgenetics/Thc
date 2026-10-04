---
name: dtf-game-development
description: Use when researching, planning, coding, debugging, redesigning, testing, deploying, migrating, or locating any DTFSeeds game, especially when aliases, duplicate copies, standalone repos, migration runtimes, public routes, or release status could be confused.
metadata:
  author: dtfgenetics
  version: "1.0.0"
---

# DTF Game Development

Resolve the exact game before implementation. The registry describes current reality; `docs/GAME_DEVELOPMENT_FREEDOM.md` allows deliberate changes to that reality when they improve the product.

## Mandatory preflight

Before implementation:

1. Read `data/game-registry-v2.json`.
2. Read `configuration/game-qa/game-profiles.json` and resolve the game's capability profile.
3. Normalize the requested title and resolve it through `aliasMap`.
4. Read the matching game entry and establish:
   - canonical game ID and title;
   - product goal and primary verbs;
   - `production.repository` and `production.sourcePaths`;
   - `gameDesignDoc` / source-of-truth document;
   - integration/runtime path and public route;
   - architecture and major systems;
   - `developmentLocations` and `deprecatedLocations`;
   - asset references;
   - build/test commands;
   - `release.status`, blockers, and next milestone.
5. Resolve the profile-driven QA requirements: gameplay, renderer, session, persistence, network, content, performance, security, and accessibility.
6. Read the game contract/source-of-truth in the canonical repo.
7. Inspect canonical source before proposing or editing code.
8. Run `npm run games:profiles:check` before implementation and include the game-specific profile checks in release verification.
9. Then use the appropriate Game Studio skill for architecture, Phaser, UI, assets, or playtesting.

Never infer authority from a folder name or deployed copy.

## Required resolution behavior

If source records conflict, resolve the conflict before gameplay changes. Prefer the v2 registry for identity/ownership/status and specialized registries for their domain details. When ownership, route, architecture, or status intentionally changes, update the registry in the same change.

A commit, build, package, or deployment attempt is not proof of production. Only `public-verified` with an exact URL, revision, and verification timestamp supports a confirmed-live claim.

## Known ambiguity cases

| Request | Resolve as |
| --- | --- |
| Burn Buds / Cannabis Battleship / Fleet Battle | `protect-the-plants`; canonical Burn Buds source, not Cannabis Fleet Battle history or a Dtf420 migration copy |
| Seed Man | `seed-man-platformer` |
| Seed Ascent | `seed-ascent`; separate game from Seed Man |
| Terpocalypse | Use the registry-recorded production source; experimental V2 is not production until an explicit cutover |
| Kush Kings | Canonical code is in `dtfgenetics/Thc-chess-git`; DTFSeeds owns integration/release metadata |
| THC U Know | Canonical code is in its standalone repo; verify persistent multiplayer runtime before public status |

## Working contract

A game task is ready for implementation only after these are known:

`canonical game ID → goal → canonical repo/source → game profile → game contract → architecture → alternate copies → build/tests → release state → next milestone`

Use Game Studio after this DTF-specific resolution, not instead of it.

## Autonomous playtest contract

For browser-playable games, treat code inspection alone as insufficient. When the runtime can support it, expose a versioned, read-only observation surface plus controlled actions that travel through normal gameplay paths.

Required target pattern:

`screenshot + structured game state + legal actions + console/network telemetry → agent decision → normal input/action path → new observation`

The structured state should include only gameplay-relevant values such as game/level ID, player position/state, score or objectives, turn/phase, health/resources, checkpoint/progress, win/loss/finish state, and active errors. Do not expose secrets or administrative controls.

The action surface must not bypass game rules. In particular, autonomous test hooks must not teleport the player, directly assign physics state, force wins, fabricate inventory, skip required objectives, or mutate authoritative multiplayer state outside the same validated action path used by players.

For qualifying games, release verification should cover:

- deterministic logic/unit tests;
- an executable agent-bridge contract test;
- browser playthrough or critical-path interaction coverage;
- desktop and mobile visual checks;
- runtime console and failed-request checks;
- soft-lock / completion detection;
- regression evidence tied to the exact commit under test.

Seed Man's reference implementation is `window.__SEED_MAN_AGENT__` plus the read-only `window.__SEED_MAN_GAME_STATE__` snapshot. Reuse the contract shape concept, not Seed Man-specific names, when adding support to other games.

## Common mistakes

- Editing `site/public-route-patch` or Dtf420 because it is easier to find than canonical source.
- Treating an alias as a separate game.
- Collapsing Seed Man and Seed Ascent.
- Promoting an experimental copy without updating ownership.
- Saying “live” because CI or packaging passed.
