# DTF Game Shared Platform

`games/shared-platform/` is the reusable browser-game infrastructure layer for the DTFSeeds game portfolio.

It is intentionally **not an engine**. Phaser, React, vanilla JavaScript, Three.js, and external canonical game repositories remain free to own their gameplay architecture. The shared platform only owns cross-game primitives that should behave consistently everywhere.

## Canonical source and public runtime

Canonical source:

- `games/shared-platform/src/`

Public browser copy:

- `site/public-route-patch/games/shared-platform/`

The public copy is generated/synchronized from canonical source. Never edit both copies independently.

```bash
npm run games:platform:sync
npm run games:platform:sync-check
npm run games:platform:test
```

The sync checker and runtime tests are part of `games:preflight`.

## Current version

Shared runtime version: **1.1.0**

Modules:

- `settings.mjs` — persistent normalized preferences and accessibility resolution;
- `audio.mjs` — browser audio unlock/policy and category-level gain management;
- `input.mjs` — named action mapping for keyboard and virtual/touch inputs;
- `replay.mjs` — deterministic action/debug recording and sanitized export;
- `telemetry.mjs` — opt-in, privacy-safe local telemetry buffering;
- `index.mjs` — stable public export surface.

## Browser import

Checked-in static games can import the shared public runtime from the Game Hub root:

```js
import {
  createGameSettingsStore,
  createReplayRecorder,
  createInputActionMap,
} from '/games/shared-platform/index.mjs';
```

When a game is also expected to run from a local relative preview, use a game-specific build/sync step that rewrites or bundles the import rather than copying shared source by hand.

External canonical repositories should adopt the contract deliberately. They may consume the public module where appropriate or implement a compatible adapter in their canonical repo with their own tests.

## Settings and accessibility

Every game that adopts shared settings gets normalized support for:

- master/music/SFX/voice volume;
- mute state;
- reduced-motion preference (`system`, `on`, `off`);
- high-contrast preference (`system`, `on`, `off`);
- UI scale clamp;
- haptics preference.

Settings are local-first and keyed per game. Games should expose only controls that make sense for that title.

Do not add a settings UI merely to demonstrate the API. Adopt settings when the game has a real setting to persist or an accessibility behavior to control.

## Audio policy

`createGameAudioManager()` centralizes:

- user-gesture audio unlock;
- `AudioContext` lifecycle;
- category gain routing;
- persistent settings synchronization;
- silence before user unlock;
- global stop/cleanup behavior.

Games remain responsible for their own music/SFX assets and for deciding which sound belongs to `music`, `voice`, or `sfx`.

## Input contract

`createInputActionMap()` maps physical controls to named gameplay actions.

Prefer action names such as:

- `confirm`
- `cancel`
- `pause`
- `restart`
- `move-left`
- `move-right`
- `move-up`
- `move-down`
- `primary-action`
- `secondary-action`

Do not scatter raw key checks throughout rendering/gameplay code when the game adopts this module. Touch/virtual controls can call `trigger(action)` so keyboard and mobile controls converge on the same action path.

## Replay/debug contract

`createReplayRecorder()` is intended for reproducible bug reports, deterministic playtest evidence, and balance debugging.

A replay bundle records:

- game ID;
- release version;
- optional seed/code;
- optional save version;
- ordered action list with relative timing;
- optional sanitized state/result snapshot;
- non-private client metadata.

Replay exports reject likely private/secret fields including passwords, tokens, authorization data, cookies, email/phone fields, private chat/message fields, room secrets, and invite keys.

A game should record **gameplay actions**, not DOM events or renderer objects. The action stream should be compact enough to reproduce a session in the deterministic engine when the game supports replay.

## Telemetry contract

Telemetry is **disabled by default**.

`createTelemetryBuffer()` only buffers events in memory until a game explicitly enables it and supplies a consumer. The shared platform does not send events to any external service by itself.

Recommended event names include:

- `game_start`
- `tutorial_complete`
- `game_complete`
- `game_abandon`
- `restart`
- `failure_reason`
- `level_reached`
- `round_reached`
- `difficulty_selected`
- multiplayer connection failures

Never place personally identifying information, private room codes, messages, credentials, or authentication data in telemetry payloads.

## Asset/performance budgets

The shared payload scanner uses:

- `configuration/game-qa/performance-budgets.json`
- `scripts/game-asset-performance-audit.mjs`

Commands:

```bash
npm run games:qa:assets
npm run games:qa:assets:strict
```

The audit reports:

- total checked-in payload size;
- JS/CSS/image/audio bytes;
- largest single file;
- file count;
- largest files per game;
- cross-game duplicate asset groups;
- soft-budget warnings;
- hard-budget failures.

Soft budgets are directional and should be tuned as real baselines are collected. Hard budgets are safety rails, not permission to fill every game up to the limit.

## Adoption order for an individual game

When adding the shared platform to a canonical game, use this order:

1. resolve the canonical source and release path;
2. run the game-specific tests before editing;
3. adopt one shared primitive at a time;
4. add/adjust game-specific tests for the behavior being replaced;
5. run `games:platform:test` and `games:platform:sync-check`;
6. run the game-specific build/test suite;
7. run portfolio browser QA for that game;
8. playtest desktop and mobile interaction;
9. only then expand adoption to another primitive.

Do not simultaneously replace input, audio, saves, multiplayer, and gameplay logic in one migration unless the existing architecture makes separate migration impossible.

## Shared platform ownership boundary

The shared platform owns reusable primitives and contracts. It does **not** own:

- game rules;
- level design;
- card/deck content;
- win/loss logic;
- multiplayer game authority;
- canonical save schema for an individual title;
- art direction;
- engine scene/state lifecycle;
- production release claims.

Those remain in the canonical game and `dtf-game-canonical-release` workflow.

## QA relationship

The shared runtime works with the portfolio browser harness documented in `docs/GAME_QA_HARNESS.md`.

The portfolio harness verifies visitor-facing fundamentals across many games. Game-specific suites still own deep gameplay assertions, completion paths, multiplayer synchronization, save migration, and exact release fingerprints.

## Next platform layers

After first-game adoption validates v1.1.0, the next shared systems should be evaluated in this order:

1. DTF Player Passport / achievements and local progression interface;
2. shared daily/weekly challenge contract where titles benefit from it;
3. optional telemetry/balance consumer integration;
4. multiplayer lobby/reconnect primitives for compatible games;
5. asset manifest/provenance contract for larger art/audio pipelines;
6. broader visual-regression baselines once screenshot stability is proven.
