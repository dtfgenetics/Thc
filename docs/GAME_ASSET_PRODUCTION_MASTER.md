# DTFSeeds Game Asset Production Master

Status: ACTIVE
Updated: 2026-09-09
Production target: https://dtfseeds.com/games/
Drive root: `04 Games`
Drive visual master tracker: `DTF Games — Visual Asset Master Tracker`

## Goal

Build a complete, professional, reusable visual/audio asset library for every DTFSeeds game and connect approved assets to the actual browser runtimes without losing source masters, approvals, provenance, or game ownership.

The system separates four concerns:

1. **Google Drive = human/source asset library.** High-resolution source art, approved masters, print masters, reference sheets, audio masters, marketing art, provenance records, and review material live in the game-specific Drive folder.
2. **GitHub = runtime asset library.** Optimized WebP/AVIF/PNG/SVG/audio/atlas/GLB files, machine manifests, mappings, tests, and deployment integration live with the owning game code.
3. **Master tracker = portfolio control surface.** Every asset family and 10-asset production batch is tracked in the Drive spreadsheet.
4. **Live route = final proof.** An asset is not complete until it is mapped, built, loaded in the game, reviewed at game scale, and verified on the exact visitor-facing route.

## Drive organization

Use the existing `04 Games/<Game>` folder for every game. Do not create a second unowned visual library.

Each game receives:

```text
04 Games/
  <Game>/
    08 Visual Assets/
      00 Art Direction/
      01 Source Masters/
      02 Approved Masters/
      03 Characters/
      04 Environments/
      05 Gameplay Objects/
      06 UI + HUD/
      07 FX + Animation/
      08 Audio/
      09 Marketing/
      10 Print/
      11 Runtime Exports/
      99 Archive/
```

`04 Games/00 Shared Game Assets` is reserved for genuinely reusable portfolio material only:

- `00 Control` — master tracker and control documents
- `01 Brand Standards`
- `02 Shared UI`
- `03 Shared Icons`
- `04 Shared FX`
- `05 Shared Audio`
- `06 Marketing Templates`
- `07 Licensing + Provenance`
- `99 Archive`

Game-specific characters, worlds, cards, logos, UI skins, effects, music, or marketing art stay in the owning game's folder.

## Asset lifecycle

Every asset or asset family moves through:

`NEEDED → CONCEPT → REVIEW → APPROVED → NORMALIZED → OPTIMIZED → INTEGRATED → VERIFIED-LIVE`

Additional terminal/control states:

- `REPLACE` — an existing asset must be redone.
- `ARCHIVED` — superseded source retained for history but not active.
- `BLOCKED` — an external dependency prevents progress; the blocker must be named.

Concept art must never be treated as runtime-approved art merely because a file exists.

## Naming and versioning

Human/source files may use descriptive names, but every tracked asset gets a stable asset ID.

Recommended ID:

`GAME-CATEGORY-SUBJECT-STATE-vNN`

Runtime file names should be lowercase and stable, for example:

`seed-man-player-fire-attack-v03.webp`

Never overwrite a materially different approved master without incrementing the version or retaining the superseded master in `99 Archive`.

## Technical output rules

### 2D raster

- Keep the largest useful source master in Drive.
- Preserve alpha when the asset requires transparency.
- Prefer WebP/AVIF for optimized opaque runtime art.
- Use WebP or PNG for alpha assets based on edge quality and browser needs.
- Avoid baked-in body copy when runtime text can render it more reliably.
- No watermarks, unintended borders, or yellow color cast.

### Vector

Use SVG for icons, logos, indicators, and UI artwork when the visual style supports vectors and the result remains safe to render in the browser.

### Sprite animation

Use one approved seed frame for a character/form, then generate the complete strip together whenever possible. Normalize the complete strip with one shared scale and a consistent bottom-center anchor. Review a preview sheet and the in-engine animation before updating the runtime atlas.

Required animation QA:

- silhouette does not drift;
- palette and proportions remain stable;
- face/key features remain readable;
- action is readable at actual game scale;
- alpha is clean;
- frame timing and contact pose make sense;
- hitbox/collision expectations are not contradicted by the art.

### 3D

When a title uses 3D assets, source masters may live in Drive, but browser shipping should normally use GLB/glTF 2.0. Apply transforms, keep pivots stable, reuse materials, define collision proxies where needed, and optimize geometry/textures deliberately. Meshopt and KTX2/Basis are preferred when the chosen runtime supports them.

### Audio

Store high-quality masters in Drive and optimized browser deliverables with the game runtime. Music/ambience loops must be clean; SFX should be normalized, unclipped, short enough for responsive playback, and tested on mobile browsers.

## UI and accessibility requirements

- Gameplay state must not depend only on color.
- Maintain readable contrast and visible focus treatment.
- Touch controls should normally provide approximately 44 px or larger practical targets.
- Review at 360, 390, and 430 px phone widths plus desktop.
- Art must not obscure essential gameplay information.
- Generated text should be minimized; labels and body copy should normally remain real HTML/canvas text.

## Marketing package required per game

A visually complete game should eventually have:

- Game Hub thumbnail
- 16:9 hero/key art
- square social image
- vertical social image
- Open Graph/share image
- title/logo treatment
- clean promotional screenshot or composite

Physical games additionally require print-safe masters, bleed/safe-area control, and printer-specific color proofing where applicable.

## Production waves

### Wave 1 — immediate production

1. Seed Man
2. Who Took It?
3. High Life
4. High IQ
5. Terpocalypse
6. Bud or Bluff

These receive complete Drive production trees now and are the first games to receive 10-asset generation batches.

### Wave 2 — major existing game systems

1. High Land
2. Weedopolis
3. Strain Showdown
4. Burn Buds

### Wave 3 — remaining public portfolio

Grower Conversations, THC Weekly Crossword, THC U Know, Kush Kings Chess, PhenoQuest, Strain Match, Grow Room Bingo, Lost in the Terps, Mystery Strain, Spin the Strain, Grow Room Defense, Harvest Hustle, Trichome Trials, Pheno Draft, High Lines.

### Wave 4 — incoming release candidates

Ganjumanji and THC RPG.

## Wave 1 detailed requirements

### Seed Man

Canonical source evidence currently defines:

- 4 phenotypes: Plant, Fire, Electric, Ice
- 9 core player states: idle, walk, run, jump, fall, land, attack, hit, victory
- 10 regular enemy archetypes
- 6 bosses
- 5 worlds: Greenhouse Valley, Forest Ruins, Desert Canyon, Frozen Peaks, Eco City
- 11 terrain classes

Current approved runtime/source evidence includes character, enemy/boss, and platform atlases, but these are a foundation rather than the complete production library.

Required production families:

- canonical Seed Man turnaround/reference package;
- full Plant/Fire/Electric/Ice animation families;
- phenotype transformation references and effects;
- 10 enemy production masters and complete animation sets;
- 6 boss masters and animation sets;
- four-phase Blight King visual progression;
- five full world kits with foreground/midground/background layers;
- 11 terrain/tile families plus moving/spring/hazard pieces;
- pickups, phenotype carriers/drops, checkpoints, projectiles, hazards and finish objects;
- HUD, health, phenotype timer, boss bar, pause/settings, level select and results;
- Plant/Fire/Electric/Ice combat FX and environmental particles;
- five world music/ambience families, boss/menu cues and core SFX;
- complete marketing package.

Initial batch sequence: `SM-001` through `SM-023` in the master tracker.

### Who Took It?

Current dedicated asset manifest confirms:

- 25 suspect portraits complete;
- one key-art piece in review;
- 18 item evidence cards missing;
- 3 suspect-board frame assets missing;
- 4 selection/elimination/hidden-state assets missing.

The complete target also includes room/table environment art, card backs, clue/evidence props, mode screens, reveal animation, audio and marketing.

Initial batch sequence: `WTI-001` through `WTI-004`.

### High Life

Current repository evidence contains one `high-life-era-journey-v1.webp` visual. The final game needs a complete three-era narrative system:

- core grower/player archetypes;
- mentors, rivals, buyers, regulators and supporting characters;
- identity-preserving character progression across Underground, Medical and Legal eras;
- three environment families and major career locations;
- visual treatment for all 18 canonical game events;
- property/asset/harvest/salary/risk/opportunity imagery;
- career HUD, era, reputation, assets, risk and results UI;
- era transitions and feedback FX;
- three-era music/ambience and UI/event SFX;
- complete marketing package.

Initial batch sequence: `HL-001` through `HL-010`.

### High IQ

The canonical v2.4/200-question runtime is functionally mature but does not currently have a dedicated game-art directory in the canonical game source.

Required visual system:

- High IQ emblem/logo/hero treatment;
- 10 topic-domain icons;
- subtle topic/background family;
- timer and question-stage graphics;
- answer-selection/correct/wrong feedback;
- streak, mastery and achievement badges;
- Daily 10 treatment;
- source/verification trust visuals;
- result/share art;
- low-distraction UI SFX and optional music bed;
- complete marketing package.

Initial batch sequence: `HIQ-001` through `HIQ-003`.

### Terpocalypse

The dedicated repository already contains an asset-folder taxonomy and a formal manifest. The current manifest marks every listed prototype asset as missing, including:

- 3 branding assets;
- 8 HUD/UI assets;
- 6 first-person weapon frames;
- 9 enemy idle/attack/death assets;
- 5 pickups;
- 4 combat FX.

The production plan expands this with level textures, props, additional enemy/boss art, damage/death states, story screens, ambience/music and marketing.

All art must remain original and must not reuse copyrighted Doom art/assets.

Initial batch sequence: `TERP-001` through `TERP-006`.

### Bud or Bluff

The current game is a playable 2–10 player multiplayer beta with room codes, simultaneous voting, hidden answers, double-hit scoring, chat, reconnect, rematch and host transfer. The visual package must reinforce those mechanics without leaking hidden answers.

Required production families:

- brand/logo/key art;
- card front/back and strain-image frame system;
- Truth/Bluff/reveal/double-hit visual grammar;
- room/lobby background and player chips;
- room-code, join, chat, voting, reveal, score, rematch and host-transfer UI;
- vote/reveal/streak/double-hit FX;
- party-game audio package;
- result/share/social art.

Initial batch sequence: `BOB-001` through `BOB-003`.

## High Land non-negotiable art note

When High Land board art is modularized or regenerated, preserve the approved continuous road geometry: one connected Candy-Land-style route, every square touching the next, no alternate route and no broken segments. The road is a fixed gameplay layer even if the world art beneath it is redesigned.

## Source-resolution rule

Do not assume a Drive search hit is an approved game asset. Resolve every candidate against:

1. owning game folder;
2. asset ID or manifest entry;
3. approval state;
4. source/provenance record;
5. intended runtime mapping.

If a file cannot be resolved, classify it as `UNRESOLVED` and do not integrate it.

## 10-asset production batch contract

Default generation unit: **10 coherent assets**.

A batch must include:

- batch ID;
- game;
- exact asset list/scope;
- visual reference/master;
- output type and dimensions/aspect needs;
- transparency requirement;
- Drive destination;
- runtime target;
- acceptance criteria;
- dependencies;
- status.

Do not mix unrelated games or unrelated visual families in one batch simply to reach ten images.

## Definition of done for an asset family

An asset family is complete only when:

1. required assets exist;
2. source masters are stored in the correct Drive game folder;
3. approval status is recorded;
4. runtime exports are optimized;
5. manifest IDs/paths are updated;
6. code actually loads the new files;
7. deterministic asset/path/build checks pass;
8. gameplay-scale desktop/mobile review passes;
9. no placeholder or retired asset remains on the active path unless intentionally retained;
10. exact visitor-facing production route is verified after release.

## Immediate execution order

1. Produce `SM-001` — canonical Seed Man character master/reference package.
2. Use the approved `SM-001` result to produce Plant, Fire, Electric and Ice animation families.
3. In parallel after Seed Man reference lock, produce `WTI-001`, `HL-001`, `HIQ-001`, `TERP-001` and `BOB-001` as the style-foundation batches for the other Wave-1 games.
4. Update the Drive tracker after every batch.
5. Only approved assets proceed to normalization/runtime export and code integration.
