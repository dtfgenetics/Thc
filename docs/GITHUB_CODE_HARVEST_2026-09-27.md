# GitHub Code Harvest — 2026-09-27

Purpose: identify mature open-source code that can improve DTFSeeds/THC tools and games without replacing working canonical systems or importing incompatible assets/licenses.

## Rules

1. Reuse code only when the license permits the intended use.
2. Preserve required copyright/license notices for copied or substantially derived code.
3. Prefer adapting small proven patterns over vendoring entire repositories.
4. Never copy third-party art/audio unless its asset license separately permits reuse.
5. Keep authoritative game rules in canonical DTF code; outside projects are references or isolated dependencies.
6. Add deterministic tests around every adopted gameplay/networking primitive.
7. Do not replace working Phaser, Colyseus, Socket.IO, chess.js, or current shared-platform systems just because another framework exists.

## Approved high-value references

### phaserjs/examples
Use for: animation/tween patterns, camera behavior, input handling, particles, scene lifecycle, mobile rendering, preload/loading patterns.
License status: source examples are MIT; repository documentation warns that example assets are separately licensed and should not be assumed reusable.
DTF target: Seed Man Run, High Land, Ganjumanji, Stoner Duck Race, other Phaser titles.

### colyseus/tutorial-phaser
Use for: room join/leave flow, authoritative room state, client synchronization, reconnect architecture.
License status: tutorial source is MIT; documented tutorial assets are CC0.
DTF target: High Land and other Colyseus-backed multiplayer games.
Constraint: current DTF backend decisions remain authoritative; do not blindly replace production Socket.IO/PHP runtimes.

### JaredReisinger/react-crossword
Use for: keyboard navigation, active clue/cell behavior, responsive crossword interaction, validation and completion UX.
License status: MIT.
DTF target: THC Crossword.
Decision: use interaction architecture as the benchmark first. The current crossword repo is vanilla Vite, so do not force a React migration unless the UX gain justifies it.

### clauderic/dnd-kit
Use for: accessible pointer/touch/keyboard drag-and-drop patterns.
License status: MIT.
DTF target: Cannabis Fleet Battle ship placement, card/deck ordering tools, drag-based editors.
Decision: preferred benchmark for Fleet Battle placement UX; adopt dependency only where DOM drag/drop is the right interaction model.

### goldfire/howler.js
Use for: robust browser audio lifecycle, sprite audio, mobile audio unlock, mute/volume behavior.
License status: MIT.
DTF target: games that outgrow the shared Web Audio tone manager and need real music/SFX assets.
Decision: do not add globally yet; use per-game when asset-backed audio requires it.

### zpao/qrcode.react
Use for: room/invite QR codes in React multiplayer lobbies.
License status: ISC; bundled QR generator has its own MIT notice.
DTF target: High Land, Kush Kings Chess, THC U Know, other React lobbies.
Decision: useful after invite-link UX is standardized; preserve required notices.

### ai/nanoid
Use for: compact collision-resistant IDs.
License status: MIT.
DTF target: non-secret client IDs, replay IDs, local draft IDs.
Decision: do not replace human-readable room codes where players need to type/share codes.

### colinhacks/zod
Use for: runtime schema validation at API/network/save boundaries.
License status: MIT.
DTF target: multiplayer payloads, save migration, tool forms, imported datasets.
Decision: highest value in TypeScript/React services; avoid adding to tiny static games that already have simple deterministic validators.

## Implemented in this pass

Shared game platform v1.3.0 adds a dependency-free browser experience layer:

- native share with clipboard fallback;
- clipboard helper with legacy fallback;
- fullscreen helper;
- optional vibration helper;
- Screen Wake Lock controller with visibility-aware reacquisition.

Canonical source:
- `games/shared-platform/src/experience.mjs`

Public runtime:
- `site/public-route-patch/games/shared-platform/experience.mjs`

This intentionally absorbs patterns that were duplicated across multiple DTF games without importing a new framework.

## Next adoption order

1. THC Crossword — benchmark against react-crossword and port missing keyboard/clue/accessibility behavior without unnecessary framework churn.
2. Cannabis Fleet Battle — improve ship placement using dnd-kit interaction patterns or an equivalent dependency-free adapter.
3. High Land / multiplayer lobbies — adopt shared `shareGameLink`, fullscreen, and wake-lock behavior; evaluate QR invite UX.
4. Seed Man Run and Phaser games — harvest animation/camera/input/loading patterns from official Phaser examples; never copy example art.
5. Multiplayer services — tighten message/save validation with Zod where TypeScript service boundaries justify the dependency.
6. Asset-backed audio — adopt Howler per game only where the current shared audio layer is insufficient.


## Integration update — continued pass

### THC Crossword
Implemented in `dtfgenetics/Thc-crossword-`:
- added `src/crossword/keyboardNavigation.js` with testable navigation intent and word-edge helpers;
- added Vitest coverage for arrows, Home/End, Space direction switching, and word boundary resolution;
- updated `src/keyboard-polish.js` so Home/End jump to the active word edge and Space switches across/down at crossings;
- retained native Tab behavior and existing mobile input handling;
- syntax/navigation smoke verification passed.

Reference influence: `JaredReisinger/react-crossword` keyboard/current-clue interaction patterns. No React migration was introduced.

### Burn Buds
Implemented in canonical Burn Buds runtime:
- added `placement-drag-v1.js` as progressive pointer/touch drag-to-place behavior;
- added `placement-drag-v1.css` with coarse-pointer targets and reduced-motion handling;
- added public shell loading and cross-game regression gates;
- preserved existing click/tap, keyboard, randomize, rotate, undo, clear, and server-authoritative placement validation;
- added selected-formation `aria-pressed` state and clearer drag/tap instructions;
- fixed synthetic-click suppression so a drag release actually commits exactly one placement;
- syntax verification passed.

Reference influence: `clauderic/dnd-kit` direct-manipulation/accessibility patterns, adapted dependency-free because Burn Buds is a vanilla browser runtime.

### Next harvest queue
1. standardize multiplayer invite/share behavior across High Land, THC U Know, Kush Kings Chess, and Burn Buds;
2. add Screen Wake Lock where long-running board/platform games benefit;
3. audit Seed Man Run Phaser camera/input/animation lifecycle against official Phaser examples;
4. add runtime schema validation at multiplayer/save boundaries where Zod is justified;
5. evaluate asset-backed audio titles for selective Howler adoption rather than global dependency use.


## Multiplayer browser-experience integration

### High Land
Integrated in `dtfgenetics/Thc`:
- added typed `apps/high-land-web/src/game/browserExperience.ts`;
- native Web Share with clipboard/manual fallback in the room lobby;
- Screen Wake Lock during active play with visibility-aware reacquisition;
- unit coverage for share fallback and wake-lock lifecycle;
- updated lobby production regression contract.

No room authority, transport, board rules, or Phaser gameplay logic was replaced.

### THC U Know
Integrated in `dtfgenetics/thc-u-know-card-game-`:
- retained the existing `qrcode.react` QR invite path instead of adding another dependency;
- centralized native share, clipboard fallback, and Screen Wake Lock in `apps/web/src/browserExperience.ts`;
- InvitePanel now automatically falls back to copying the invite when native sharing fails;
- active GameTable requests Screen Wake Lock during play;
- lobby production contract now enforces QR + share/copy fallback + wake-lock behavior.

Socket.IO room authority and the shared card engine remain unchanged.

### Kush Kings Chess
Integrated in `dtfgenetics/Thc-chess-git`:
- added `client/src/lib/browserExperience.ts`;
- live room links prefer native share and fall back to clipboard;
- archived match links remain copy-oriented;
- match view requests Screen Wake Lock and reacquires it on visibility return;
- added `scripts/browser-experience-contract.mjs` to the production runtime checks.

Chess.js move authority, Socket.IO room events, PostgreSQL persistence, spectators, chat, draw/resign/abandon/rematch behavior, and archive semantics remain unchanged.

### Shared implementation rule
For future browser games, prefer the same contract:
1. native share when it improves invite UX;
2. clipboard fallback;
3. manual/QR fallback where appropriate;
4. Screen Wake Lock only during long-running active play;
5. all APIs remain progressive enhancement and must never block gameplay;
6. keep game/network authority outside browser-experience helpers.
