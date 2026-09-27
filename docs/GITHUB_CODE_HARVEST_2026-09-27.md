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


## Additional GitHub harvest — platformer + cultivation tools

### ourcade/sidescrolling-platformer-template-phaser3
License: MIT.
Useful pattern: explicit finite-state-machine controller with enter/update/exit lifecycle and queued transitions.
Action taken: adapted the state-machine utility into `games/shared-platform/src/state-machine.mjs`, preserved attribution in `docs/THIRD_PARTY_NOTICES.md`, added runtime tests, synced the public module, and bumped the shared game platform to v1.4.0.
Do not copy the template's character art or map assets.

### yandeu/phaser3-typescript-platformer-example
License: MIT.
Useful as a secondary reference for PWA/platformer project structure. No code copied in this pass because Seed Man already has stronger movement fundamentals than the example: fixed timestep, coyote time, jump buffering, jump-cut gravity, double jump, look-ahead camera, checkpoints, gamepad support, and deterministic tests.

### Current Seed Man conclusion
Do not replace Seed Man with a Phaser starter simply for framework fidelity. The current canonical runtime already contains the platformer mechanics those templates would provide. Future harvest work should target missing controller/state organization, animation/event separation, loading/error boundaries, and reusable VFX/audio patterns rather than rewriting movement physics.

### VPD logger workflow research
A GitHub VPD calculator example demonstrated the value of CSV sensor-history analysis, but no reusable license was present on that repo, so none of its code was copied.
Action taken: independently implemented a native local CSV workflow in `/vpd-chart/`:
- flexible timestamp / temperature / RH / leaf-temperature or leaf-offset headers;
- row-by-row leaf-VPD calculation;
- average/min/max summaries;
- native canvas trend chart;
- bounded trend table;
- browser-local processing with no upload or CDN dependency;
- production validation markers added.

### Nutrient-calculator repositories reviewed
`dstrelnikov/hydrosolver`, `nikitapn/nscalc`, and `onethree7/Horticalc` are GPL-family references. Treat them as research/benchmark sources only unless the licensing implications are intentionally accepted for a separate compatible component.
`DanielEnki420/dwc-grower-edition` is MIT and is a useful benchmark for local-first grow records, sensor warnings, refill workflows, and mobile calculator UX. Do not copy manufacturer nutrient schedules or claims without independently verifying current official source data.


## Additional harvest — loading + CSV infrastructure

### Phaser official Vite template
License: MIT.
Useful pattern: Boot → Preloader → progress event → gameplay scene.
Action taken: extracted the useful lifecycle concept into an engine-neutral DTF shared loader rather than converting existing games to Phaser.
- `games/shared-platform/src/loading.mjs`
- parallel task loading
- progress callbacks
- bounded retry
- aggregated failures
- deterministic runtime tests
- shared platform bumped to v1.5.0

Seed Man's production bootstrap now uses this loader for its eight canonical JSON resources and exposes progress/retry behavior without changing its movement, renderer, combat, or campaign systems.

### Papa Parse 5.7.0
Repository: https://github.com/mholt/PapaParse
License: MIT.
Action taken: vendored the official browser build at `site/public-route-patch/assets/vendor/papaparse-5.7.0.min.js`, preserved attribution, and adopted it in:
- `/vpd-chart/` logger CSV imports;
- `/ppfd-chart/` canopy-map CSV imports.

Both tools retain lightweight fallback parsing so CSV workflows degrade gracefully if the vendor asset fails to load.

Why this is higher fidelity than the former parser:
- RFC 4180-style quoted-field handling;
- embedded commas/line breaks;
- structured header parsing;
- empty-row handling;
- battle-tested browser CSV behavior.

Production validators now require the vendored parser integration on both measurement tools.


## Additional harvest — audio + validation

### howler.js 2.2.4
License: MIT.
Action taken: vendored `howler.core-2.2.4.min.js` into High Land and replaced its one-HTMLAudio-element-per-effect manager behind the existing API.
Benefits now used:
- reliable Web Audio / HTML5 fallback behavior from Howler;
- pooled/reusable effect objects instead of allocating a new audio element on every SFX play;
- looping background music;
- overlapping effects;
- global mute;
- playback/load error hooks;
- mobile/browser audio handling.
High Land's existing CC0 audio assets and game call sites were preserved.

### Zod / Ajv validation research
Both are MIT-licensed, mature validators. A full dependency is justified for large network/API contracts, but would be unnecessary weight for the small static save/import shapes currently being fixed.
Action taken: added a compact DTF shared `validation.mjs` with safe JSON parsing, structured issues, explicit object shapes, literal/string/number/string-array rules, and unknown-key rejection. Shared platform bumped to v1.6.0.
Seed Man save v2 now rejects malformed JSON, wrong save versions, invalid arrays, out-of-range percentages, and unexpected fields before restoring state.

### idb-keyval
License: Apache-2.0.
Useful future target: IndexedDB-backed local persistence for larger histories/media-capable tools where localStorage becomes too small or synchronous.
Decision: do not migrate small settings/saves yet. Evaluate for GrowLens, image-heavy journals, large measurement histories, and offline tool records.


## Additional harvest — public-site search + certification infrastructure

### Pagefind 1.5.x
Repository: `Pagefind/pagefind`.
License: MIT.
Decision: **preferred search architecture for the public THC knowledge corpus**.

Why it fits this project:
- Dtf420 already produces a static child-route overlay, so Pagefind can index the generated HTML after build;
- the current Dtf420 EducationSearch client imports many Academy, Atlas, plant-health, cultivation, symptom, tool, evidence, glossary and SOP JSON datasets directly into the client search component;
- Pagefind shifts indexing to build time and serves segmented search assets on demand;
- this scales better as the encyclopedia/course corpus expands and avoids making the search route carry the source corpus.

Integration rule:
1. preserve the branded existing THC search UI;
2. replace only the corpus/ranking backend;
3. attach content-type/category metadata to generated pages;
4. exclude account, assessment-answer, cart/checkout, draft and duplicate-print routes;
5. add deterministic search fixture tests for VPD, PPFD, pH meter, root-zone hypoxia, edema, yellow lower leaves, HLVd, rhizosphere, breeding and water activity;
6. keep MiniSearch only as a fallback for small in-memory application datasets.

### Better Auth
Repository: `better-auth/better-auth`.
License: MIT.
Decision: preferred authentication/authorization candidate for the future authenticated learner and certification runtime.

Use for:
- learner identity;
- secure sessions;
- verified account flows;
- authorization around assessment attempts and credential records.

Do not bolt authentication onto the existing static assessment pages independently. Authentication must land with the persistent assessment/learner schema and server runtime. Public course content remains readable without requiring an account unless a specific protected action needs identity.

### Drizzle ORM
Repository: `drizzle-team/drizzle-orm`.
License: Apache-2.0.
Decision: preferred typed SQL layer once the production database target is selected.

Target records:
- learners/users (linked to auth identity);
- course enrollment/progress;
- assessment definitions and immutable versions;
- assessment attempts;
- answer selections;
- grading results;
- credential awards;
- certificate issuance/revocation;
- verification events/audit records.

The database target must be selected before installing Drizzle. Do not introduce an embedded SQLite file on a deployment model where multiple stateless instances need shared authoritative state.

### Zod
Repository: `colinhacks/zod`.
License: MIT.
Decision: use at certification/API trust boundaries once that TypeScript runtime is built.

High-value schemas:
- start-attempt request;
- answer-save request;
- final submission;
- grader result;
- credential issuance input;
- verification lookup response;
- imported question-bank records.

This does not replace the lightweight dependency-free validators already added to tiny static game/save formats.

### pdf-lib
Repository: `Hopding/pdf-lib`.
License: MIT.
Decision: preferred candidate for generated printable certificate PDFs after successful credential issuance.

Use server-side where possible to:
- fill a controlled certificate template;
- render learner display name;
- render credential title;
- render issue date;
- render unique credential/reference ID;
- embed a QR image pointing to the canonical verification route;
- set PDF metadata.

Important: the PDF is an output artifact, not the authoritative credential record. Regenerating the document must be possible from the immutable server-side credential record.

### Nano ID
Repository: `ai/nanoid`.
License: MIT.
Decision: suitable for opaque, URL-safe public credential/reference IDs if the database does not already issue an appropriate public identifier.

Do not use a short human-friendly identifier as the sole secret or authorization token. Public verification IDs are identifiers, not authentication credentials.

### Credential QR generation
Use a maintained MIT/ISC QR implementation only to encode the canonical verification URL, for example:
`https://dtfseeds.com/verify/<public-credential-id>`.

The verification page must read the authoritative server record and show status (valid/revoked/expired where applicable), credential title, issue date and the minimum learner identity needed for verification. The QR itself must never contain private learner records or answer data.

### Certification implementation boundary
The existing WordPress course publishers correctly hide summative answer keys and describe an authenticated assessment runtime, but repository search does not show a complete Dtf420 learner/auth/attempt/credential implementation yet.

Do not copy a generic quiz application to fill this gap. Build the certification subsystem around:
1. authenticated identity;
2. versioned question banks;
3. server-authoritative attempt clocks;
4. persisted learner selections;
5. locked submission;
6. server-side grading;
7. immutable result records;
8. credential issuance only after required gates pass;
9. verifiable certificate output;
10. revocation/audit support.

## Site/education adoption order

1. Pagefind search index behind the existing branded search UI.
2. Database target decision for authoritative learner/certification state.
3. Better Auth + Drizzle integration on the selected runtime/database.
4. Zod schemas on all assessment/credential API boundaries.
5. Persistent learner progress and attempt engine.
6. Credential issuance/verification records.
7. pdf-lib certificate generation.
8. QR verification links.
