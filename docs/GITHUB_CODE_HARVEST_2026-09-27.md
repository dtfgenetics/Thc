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


## Additional harvest — interactive trends + next candidates

### uPlot 1.6.32
License: MIT.
Action taken: vendored the official browser build and stylesheet under `site/public-route-patch/assets/vendor/` and upgraded the VPD logger trend visualization.
Benefits now used:
- cursor inspection;
- drag-to-zoom on the x axis;
- responsive resizing;
- compact time-series runtime;
- existing native canvas chart retained as the failure fallback.

The VPD equations, CSV import rules, local-only processing, metrics and results table remain authoritative and unchanged.

### MiniSearch
Repository: https://github.com/lucaong/minisearch
License: MIT.
Use for: client-side full-text search across the large Learn/Encyclopedia/course/atlas catalog where substring filtering is no longer sufficient.
Why it fits: fuzzy search, prefix search, ranking, field boosting and suggestions with zero runtime dependencies; it can run locally/offline in the browser.
Decision: high-priority next research target. Build one shared education index rather than adding separate search implementations to each surface.

### focus-trap
Repository: https://github.com/focus-trap/focus-trap
License: MIT.
Use for: complex dialogs, game setup overlays, invite modals and certification dialogs that currently need reliable keyboard focus containment.
Decision: adopt only where a real modal exists; do not add globally just to replace simple menu focus behavior.

### Workbox
Repository: https://github.com/GoogleChrome/workbox
License: MIT.
Use for: service-worker generation, cache versioning and offline asset strategies where current hand-written service workers become difficult to maintain.
Decision: benchmark GrowLens/offline tools first. Do not introduce it to static pages that do not need offline behavior.

### Jake Archibald idb
Repository: https://github.com/jakearchibald/idb
License: ISC.
Use for: structured IndexedDB state where GrowLens or other journals outgrow direct IndexedDB/localStorage helpers.
Decision: stronger future choice than idb-keyval when transactions, multiple stores, migrations and indexed queries become necessary; no migration until a concrete storage boundary needs it.

### Phaser Rex plugins
Repository: https://github.com/rexrainbow/phaser3-rex-notes
License: MIT.
Use for: reference patterns for virtual joystick/touch controls, UI widgets, camera/input helpers and Phaser-specific interaction problems.
Decision: reference selectively. Seed Man already has dedicated touch controls, so do not replace working controls merely to adopt a plugin.

## Education search implementation — Fuse.js + Pagefind benchmark

### Fuse.js 7.1.0
Repository: https://github.com/krisk/Fuse
License: Apache-2.0.
Action taken:
- vendored the pinned 7.1.0 ESM build;
- restored the missing canonical `/learn/search/` source page;
- added weighted fuzzy search over title, keywords, summary, type and stable IDs;
- added resource-type filtering;
- added a deterministic validator;
- added `build:education-search` and `validate:education-search` package scripts;
- added a source-driven index generator that can pull public navigation, encyclopedia JSON, Plant Atlas systems and Terpene Atlas compounds into one shared search index.

This fixes a structural defect: navigation and the WordPress learning publisher referenced `/learn/search/`, but its canonical static source was absent from the repository.

### Pagefind
Repository: https://github.com/Pagefind/pagefind
Use for: indexing fully rendered static HTML after build/deploy packaging.
Strengths: static-site-wide indexing, page filters, no search backend, compact browser delivery.
Decision: keep as the next benchmark rather than replacing Fuse immediately. DTFSeeds mixes WordPress-owned pages and static/public-route overlays, so a Pagefind index would only be complete if the production pipeline first renders or crawls the combined visitor-facing surface. Fuse plus a source-generated canonical index works across that mixed ownership model today. If the education system moves toward a unified static export, Pagefind becomes a strong candidate for whole-page search.

### FlexSearch / Orama
FlexSearch and Orama are capable browser search engines. FlexSearch supports document search, workers, persistent indexes and suggestions; Orama supports full-text and vector/hybrid search in a zero-dependency TypeScript engine. They are currently more machinery than the THC education navigation search requires. Revisit them if the project needs large persistent indexes, semantic/vector retrieval or substantially larger datasets.

## GrowLens modal accessibility harvest

### focus-trap
Repository: https://github.com/focus-trap/focus-trap
License: MIT.
Reference patterns reviewed: initial focus, Tab/Shift+Tab containment, Escape handling, and restoration of focus to the element that launched the modal.
Action taken: implemented the small subset GrowLens needs as a dependency-free React hook in `apps/growlens-web/src/useModalFocusTrap.ts` rather than adding the full library to the bundle.
Integrated into:
- Complete Backup;
- Account Sync;
- Safe Auto-Sync.

The shared hook now:
- focuses the first usable control when a dialog opens;
- keeps keyboard focus inside the active modal;
- cycles forward/backward at the first/last focusable element;
- closes on Escape;
- restores focus to the prior launcher after close;
- falls back to focusing the dialog panel if it contains no usable controls.

A deterministic source-contract test in `apps/growlens-web/src/modalAccessibility.test.ts` protects this behavior.

Decision: continue migrating the remaining GrowLens modal widgets to this shared hook before considering a direct `focus-trap` dependency. The current requirement is small enough that the local implementation is easier to audit and avoids unnecessary runtime weight.

### idb
Repository: https://github.com/jakearchibald/idb
License: ISC.
Current GrowLens photo storage already has a narrow, working native IndexedDB wrapper with one `photos` store and two indexes. Replacing it immediately would add migration risk without adding user-visible capability.
Next trigger for adoption: multiple object stores, cursor/range queries, schema migrations beyond the current photo store, or transaction coordination across record families. Until then, keep the existing photoStore API stable and benchmark future storage work against `idb` rather than rewriting it preemptively.

## GrowLens offline/PWA resilience harvest

### Service-worker update UX
Reference patterns reviewed from open-source PWA helpers and service-worker update implementations: detect `registration.waiting`, observe `updatefound`, and activate a downloaded worker only after explicit user action via `SKIP_WAITING`.
Action taken:
- added `PwaHealthWidget.tsx` to GrowLens;
- shows online/offline status and current service-worker registration state;
- detects a waiting service worker;
- provides an explicit “Install downloaded update” action;
- listens for `controllerchange` and reloads only after the user approves activation;
- added a `SKIP_WAITING` message handler to `public/sw.js`.

This avoids forcing an app-shell reload while a grow record or form may be in progress.

### Browser Storage API
Patterns reviewed from StorageManager examples using `navigator.storage.estimate()`, `persisted()`, and user-triggered `persist()`.
Action taken:
- GrowLens now reports approximate site-origin storage usage and quota when the browser exposes them;
- reports whether browser storage is persistent or best-effort;
- allows the user to request persistent storage explicitly;
- clearly states that the estimate covers the whole site origin, not only GrowLens;
- keeps complete backups as the disaster-recovery boundary rather than implying persistent storage is guaranteed.

### Workbox
Repository: https://github.com/GoogleChrome/workbox
License: MIT.
Decision after audit: do not migrate GrowLens yet. The current service worker has a narrow shell cache and an explicit privacy boundary for `/api/` requests. Workbox becomes justified when precache manifests, routing rules, cache expiration, background strategies, or multiple runtime cache classes become materially more complex. A framework migration now would add more surface area than capability.

### vite-plugin-pwa
Repository: https://github.com/vite-pwa/vite-plugin-pwa
Decision: benchmark only. GrowLens already has a custom service worker with privacy-specific request handling and deployment expectations. Revisit if the build pipeline is standardized around generated manifests and service-worker injection.


## Cultivation tool measurement-journal harvest

### Shared measurement journal
Action taken: added `site/public-route-patch/assets/thc-measurement-journal-v1.js` and reused the already-vetted vendored Papa Parse + uPlot stack rather than adding another CSV/chart dependency.

Capabilities:
- capped browser-local measurement history;
- explicit storage-failure disclosure;
- CSV export/import;
- destructive-action confirmation;
- reusable uPlot trend rendering;
- responsive chart resizing;
- configurable field schemas and normalization.

### pH Reference
Action taken:
- local pH measurement journal;
- date/time, meter/probe ID, last calibration date, sample context and notes;
- CSV import/export;
- interactive saved-reading trend;
- pH values validated to 0–14 before persistence/import.

This changes the pH surface from a one-reading reference calculator into a repeatable measurement-record workflow without pretending the browser measures pH.

### TDS / EC Reference
Action taken:
- local EC measurement journal;
- original EC preserved alongside derived 500/700 ppm values;
- date/time, meter ID, calibration/check date, sample temperature, sample context and notes;
- CSV import/export;
- interactive saved-EC trend;
- imported readings validated before local persistence.

The journal deliberately treats ppm values as meter-display conventions derived from EC; it does not infer nutrient identity.

### Fuse.js reuse in Terpene Atlas
The Terpene Atlas previously used literal `String.includes()` matching across concatenated compound fields.
Action taken: reused the existing vendored Fuse.js 7.1.0 ESM build for weighted fuzzy search across:
- canonical compound name;
- aliases;
- aroma descriptors;
- formula;
- terpene family/class;
- subclass;
- stereochemistry;
- isomer group.

Family and evidence-scope filters remain explicit filters after fuzzy ranking.

### simple-statistics
Repository: https://github.com/simple-statistics/simple-statistics
Potential use: robust reusable descriptive statistics, quantiles, linear regression, correlation and distribution summaries for GrowLens histories, environmental logger analysis and future cultivation comparison tools.
Decision: research target only. Existing PPFD calculations are intentionally transparent and small; do not replace simple formulas. Consider adoption when GrowLens trend analysis needs median/quantiles/regression/correlation across larger datasets.

### Observable Plot
Repository: https://github.com/observablehq/plot
Potential use: richer exploratory scientific charts for Atlas/sample-comparison dashboards where declarative multi-variable plots would materially improve analysis.
Decision: do not add to the meter tools. uPlot remains the better small time-series runtime. Revisit for Terpene Atlas population/sample comparisons or research dashboards if those views become multi-dimensional.


## GrowLens photo comparison harvest

### @panzoom/panzoom
Repository: https://github.com/timmywil/panzoom
Reviewed package version: 4.6.2
License: MIT.
Use for: native-transform pan/zoom interaction if GrowLens later needs draggable synchronized inspection panes.

Decision: do not add the dependency yet. GrowLens currently needs synchronized zoom, overlay, and alignment guidance more than free-form panning. Those controls were implemented with small first-party transforms so both comparison panes remain deterministic and easier to keep synchronized. Revisit Panzoom if drag/pinch pan becomes a validated requirement.

### blockhash-js
Repository: https://github.com/commonsmachinery/blockhash-js
License: MIT.
Use for: perceptual image hashing / near-duplicate screening.

Decision: reference algorithm family rather than add the full dependency. Added a small local difference-hash implementation in `apps/growlens-web/src/photoVisualComparison.ts` for user-facing duplicate screening only.

Implemented:
- synchronized 1×–2.5× zoom across selected before/after views;
- opacity overlay mode;
- alignment guides;
- local 64-bit difference-hash comparison;
- near-duplicate warning at a conservative high-similarity threshold;
- explicit language that hash similarity is not a measure of plant improvement or decline;
- deterministic hash-distance tests.

### Cropper.js
Repository: https://github.com/fengyuanchen/cropperjs
License: MIT.
Potential use: deliberate crop/rotation normalization for repeat-photo records.
Decision: do not add until GrowLens stores non-destructive crop/alignment metadata separately from the original photo. Source photos must remain unchanged.

### OpenCV.js
Repository: https://github.com/opencv/opencv
License: Apache-2.0.
Potential use: feature matching, geometric registration, or advanced image comparison.
Decision: keep lazy/optional. Current manual overlay and alignment workflow should be validated before adding the much larger WebAssembly runtime.


## Event-linked environment timeline harvest

### vis-timeline
Repository: https://github.com/visjs/vis-timeline
License: dual Apache-2.0 OR MIT.
Use for: dense interactive timelines with ranges, groups, zooming and many event types.

Decision: do not add yet. GrowLens already has a plant timeline and the current need is analytical context around measured events, not a general-purpose timeline framework. Revisit when the product needs large multi-lane timelines, range selection, or synchronized event/chart navigation.

### TimelineJS3
Repository: https://github.com/NUKnightLab/TimelineJS3
License: MPL-2.0.
Decision: not a good fit for GrowLens. It is optimized for narrative/story timelines rather than high-frequency private cultivation records and analytical before/after comparisons.

### Action taken: event/environment windows
Added `apps/growlens-web/src/eventEnvironmentInsights.ts`.

For irrigation and feeding events GrowLens can now:
- resolve the relevant grow space from the record, plant, or linked reservoir;
- collect readings in a configurable window before and after the event;
- refuse a comparison unless both sides have data;
- keep readings scoped to the same grow space;
- compare average temperature, RH, VPD and PPFD before vs after;
- surface recent event-linked deltas in Cultivation Analytics.

The UI explicitly calls these temporal associations, not causal effects. Lighting schedule, HVAC cycling, weather, sensor placement, time of day and concurrent changes remain plausible confounders.

Deterministic coverage: `apps/growlens-web/src/eventEnvironmentInsights.test.ts`.


### Pixelmatch 7.2.0
Repository: https://github.com/mapbox/pixelmatch
Reviewed version: 7.2.0
License: ISC.

Action taken:
- vendored the upstream ESM source under `apps/growlens-web/src/vendor/pixelmatch-7.2.0.js`;
- preserved the ISC license;
- added a typed GrowLens wrapper for browser-local difference rendering;
- added a selectable Pixel Difference view to the before/after photo comparison panel;
- added deterministic vendor integration tests.

The preview normalizes both selected photos onto the same comparison canvas and renders a pixel-level difference image. The displayed mismatch percentage is explicitly labeled as a pixel/framing aid only. Camera position, focal length, lighting, plant movement, background and alignment can dominate the result, so it must not be interpreted as disease severity, growth rate, or treatment effectiveness.

Decision: keep Pixelmatch optional within the comparison workflow. Do not run it automatically on every saved image.
