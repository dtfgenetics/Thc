---
name: dtf-game-production
description: End-to-end production orchestration for DTFSeeds games across browser runtimes, Blender asset/animation work, Unity, Unreal Engine, voice/audio, gameplay architecture, QA, and canonical release.
---

# DTF Game Production

Use this skill whenever a DTFSeeds game must be designed, repaired, expanded, visually upgraded, animated, optimized, playtested, or prepared for release.

This is an orchestration skill. It does not replace game-specific skills or the canonical release workflow. It chooses the right production path, preserves canonical ownership, and routes work to the correct implementation, asset, audio, QA, and release layers.

## Primary outcome

A game is not considered improved merely because code changed or a build passed. The target is a coherent playable experience with verified gameplay, intentional visuals, responsive controls, optimized assets, suitable audio, reproducible tests, and a validated path to production.

## Mandatory first step: resolve the game before editing

Before changing code or assets:

1. Resolve the public game slug and expected player experience.
2. Read `data/game-source-map.json`, project/source registries, game-specific `SOURCE_OF_TRUTH.md`, and the `dtf-game-canonical-release` skill.
3. Identify the canonical repository/path, current production route, build system, and release workflow.
4. Inspect the current implementation before proposing a rewrite.
5. Preserve working systems and user-authored assets unless replacement is justified by a measurable production problem.
6. Never create a new `-v2`, `-v3`, `-final`, or duplicate project merely to avoid repairing the canonical implementation.

## Production classification

Classify the game before implementation.

### 2D browser-first

Prefer Phaser or the existing browser runtime for:

- board games,
- card/trivia games,
- crosswords and puzzles,
- platformers,
- arcade-style games,
- grid/tile games,
- UI-heavy multiplayer games.

Do not introduce Unity or Unreal unless the existing design genuinely needs capabilities the web stack cannot provide efficiently.

### 3D browser-first

Prefer Three.js or React Three Fiber when the game must remain a lightweight web experience and needs:

- 3D scenes,
- first-person or third-person exploration,
- animated GLB/glTF characters,
- WebGL effects,
- DOM-based HUD/UI integrated with a 3D playfield.

### Unity

Choose Unity when its runtime and tooling are the best fit for:

- more advanced 2D/3D game systems,
- reusable animation/state-machine tooling,
- physics-heavy gameplay,
- mobile/desktop targets,
- WebGL builds where build size and compatibility are acceptable,
- projects likely to expand beyond a simple browser game.

### Unreal Engine

Choose Unreal Engine for sufficiently ambitious projects requiring:

- high-fidelity 3D environments,
- complex character animation,
- advanced lighting or Niagara VFX,
- cinematic sequencing,
- larger first/third-person gameplay systems,
- substantial AI or world simulation.

Do not choose Unreal for a crossword, board game, trivia game, or other UI-first game simply because it is available.

## Shared architecture contract

Regardless of engine:

1. Simulation/gameplay state must be separable from presentation where practical.
2. Input actions must be defined explicitly and mapped in one place.
3. Runtime assets must be referenced through stable manifest/registry keys, not scattered filenames.
4. Save data must contain serializable game state, not renderer or engine scene objects.
5. Rendering, UI, audio, save/persistence, and gameplay rules must not become one monolithic module.
6. Every game must expose a deterministic restart/reset path.
7. Debug and performance instrumentation must be removable or gated from production.

## Blender pipeline

Blender is the canonical DCC tool for custom 3D game assets and animation unless the canonical project documents another source tool.

For every Blender-authored runtime asset:

- use consistent real-world scale and axis conventions,
- apply/normalize transforms before export,
- set gameplay-correct origins and pivots,
- use stable object, bone, action, and material names,
- clean topology for the intended deformation/use,
- define UVs and material reuse intentionally,
- create collision proxies when gameplay needs them,
- create LODs when repeated or large assets need them,
- keep source `.blend` files separate from shipped runtime assets,
- export a reproducible engine-target format.

Browser shipping format defaults to GLB/glTF 2.0. Unity and Unreal may use engine-appropriate import formats upstream, but source naming, scale, skeleton, animation, and material conventions must remain controlled.

Animation clips must have explicit names such as `Idle`, `Walk`, `Run`, `Jump`, `Attack`, `Hit`, `Interact`, or game-specific equivalents. Avoid anonymous timeline ranges that runtime code must guess.

## Visual production rules

Visual improvement must serve gameplay readability and the game fantasy.

Audit:

- hierarchy and focal point,
- player/enemy/interactive-object separation,
- animation readability,
- HUD density,
- typography and contrast,
- touch-target sizing,
- background/foreground separation,
- visual feedback for hover/press/hit/win/loss/error,
- consistency with DTFSeeds branding without over-branding the playfield.

Do not call a game visually improved after only changing gradients, shadows, or colors when its composition, hierarchy, assets, feedback, or layout remain weak.

## Audio and voice pipeline

Treat audio as a first-class system.

Define categories:

- music,
- ambience,
- UI,
- gameplay SFX,
- character/NPC voice,
- narration/tutorial.

ElevenLabs may be used for suitable character dialogue, narration, tutorial voice, or announcer audio. Generated voice must be treated as an asset pipeline with stable filenames/IDs, script source, version notes, loudness normalization, and licensing/provenance records where applicable.

All games with audio must support:

- master volume,
- music volume or mute,
- SFX volume or mute,
- persistent user settings where practical,
- no forced autoplay that violates browser policy.

## Performance budgets

Establish budgets before major art/engine expansion.

At minimum measure:

- initial download size,
- largest runtime assets,
- texture sizes and count,
- material/draw-call pressure for 3D,
- memory growth during a normal session,
- frame rate on target desktop and mobile hardware classes,
- input latency and long-task spikes,
- audio payload size.

For web 3D, optimize GLB/glTF assets with pruning, deduplication, simplification, mesh compression when appropriate, and compressed textures such as KTX2/BasisU where supported.

## Required playtest loop

Every material gameplay change must be validated through the strongest available layer:

1. static/source checks,
2. unit/state tests,
3. build validation,
4. automated interaction tests,
5. browser or engine playtest,
6. production-route verification after release.

A build is not a playtest.

For each game, test at least:

- startup,
- start/new-game flow,
- primary movement/interaction/turn action,
- one meaningful game-state transition,
- loss/failure handling where applicable,
- win/completion handling where applicable,
- restart/reset,
- pause/settings if present,
- save/load if present,
- mobile layout and touch controls when the game is public on DTFSeeds.

## Upgrade workflow

When asked to improve a game:

### 1. Establish intended experience

Write down:

- player fantasy,
- primary verbs,
- core loop,
- target session length,
- failure/win conditions,
- progression/replay value,
- intended device classes.

### 2. Audit current state

Score 0-5:

- gameplay clarity,
- controls,
- responsiveness,
- visual hierarchy,
- art/animation quality,
- sound/feedback,
- content completeness,
- accessibility,
- performance,
- production reliability.

Record evidence for every score below 4.

### 3. Fix blockers before polish

Priority order:

1. startup/crash/data-loss,
2. broken core loop,
3. unusable controls or mobile layout,
4. missing critical assets/content,
5. severe performance problems,
6. feedback/readability,
7. visual polish,
8. optional effects and content expansion.

### 4. Select production tools

Use `references/engine-selection.md` and `references/asset-audio-pipeline.md`. Do not migrate engines without documenting why the migration produces a better shippable game than repairing the current runtime.

### 5. Implement in canonical source

Keep changes focused and testable. Add regression coverage for repaired bugs. Use a dedicated branch/PR when repository workflow supports it; do not fork a new pseudo-canonical implementation.

### 6. Pass definition of done

Use `references/definition-of-done.md`, then hand the validated result to `dtf-game-canonical-release` for integration, deployment, live verification, and evidence reporting.

## Required completion report

Every game-production task must report:

- game and canonical source,
- current engine/runtime,
- whether engine migration occurred and why,
- gameplay changes,
- visual/animation changes,
- Blender/asset changes,
- audio/voice changes,
- tests/builds/playtests performed,
- performance findings,
- remaining issues,
- highest release evidence level achieved under `dtf-game-canonical-release`.

Never claim production readiness while critical gameplay, mobile, asset, performance, or release verification remains untested.
