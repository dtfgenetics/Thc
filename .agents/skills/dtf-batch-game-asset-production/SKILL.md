---
name: dtf-batch-game-asset-production
description: Batch-produce missing visual game assets for DTF games. Use when creating multiple cards, icons, portraits, props, UI elements, backgrounds, enemies, collectibles, terrain, or other visual assets that must be generated efficiently and stored for Drive, GitHub, and site/runtime use.
---

# DTF Batch Game Asset Production

## Purpose

Create the maximum useful number of missing visual game assets per production pass while preserving consistency, naming discipline, file structure, and runtime compatibility.

This skill is for actual game assets, not generic inspiration boards. Concept sheets may be generated for review, but they are never treated as runtime assets unless explicitly converted into individual production files.

## Default Batch Size

- Produce up to **10 individual images per generation batch** when the image tool supports it.
- Prefer a single multi-output generation call over ten separate calls when the assets are independent.
- If a set contains more than 10 assets, split it into numbered waves of up to 10.
- Never substitute a single collage or contact sheet when the requirement is for individual production assets.

## Two Production Modes

### 1. Parallel Batch Mode

Use when each image is largely independent and can share a common art direction without exact frame-to-frame continuity.

Best for:
- evidence cards
- item cards
- collectible art
- icons
- buttons
- props
- badges
- map markers
- location cards
- standalone environment objects

Workflow:
1. Audit the current manifest/repo/Drive contents.
2. Remove anything already complete or already present.
3. Select the next 1-10 missing assets.
4. Generate all selected assets in one batch.
5. Verify labels, object identity, proportions, margins, and visual consistency.
6. Store approved masters in the proper Drive and repo folders.
7. Export runtime variants when needed.

### 2. Anchor-First Batch Mode

Use when the assets must visually match each other closely.

Best for:
- character sets
- suspect portraits
- enemy families
- sprite animation strips
- matching card systems
- board landmarks
- related UI families
- environment sets that must share perspective and palette

Workflow:
1. Identify or generate one approved anchor image.
2. Lock the anchor's silhouette, palette, rendering, proportions, framing, camera angle, and lighting.
3. Use the anchor as the visual reference for the next batch.
4. Generate up to 9 additional matching assets in the same pass.
5. Reject drift rather than accepting mismatched art.

## Missing-Asset Audit Rule

Before generating anything:
- inspect the game's production manifest when available;
- inspect existing repo asset directories;
- inspect the game's Drive visual asset folders when available;
- do not regenerate assets already marked complete unless replacement is requested;
- prioritize P0/P1 missing assets before polish-only work.

## Card Asset Rules

Lock across the batch:
- identical card dimensions
- identical border/frame language
- identical title placement
- identical typography treatment
- consistent safe margins
- consistent lighting and object scale
- one clearly identifiable object or subject per card unless the game design requires otherwise

Generate cards as individual images, never as cropped slices from a poster.

## 2D Sprite Rules

For animation work:
- follow the sprite-pipeline skill;
- start from an approved in-game seed frame;
- generate a full strip at once when possible;
- use a transparent background;
- keep the same facing direction, silhouette, palette, proportions, and anchor;
- normalize final frames to fixed dimensions and a shared bottom-center anchor;
- do not use poster-style art as a sprite atlas.

## UI Rules

For UI batches, lock:
- panel bevel and border language
- font family/treatment
- button proportions
- spacing system
- icon stroke/render style
- hover/pressed/disabled-state logic when states are requested
- readability at actual in-game scale

## Background and Environment Rules

For gameplay backgrounds:
- create full-size source masters, not collage thumbnails;
- preserve readable gameplay silhouettes;
- avoid embedding labels, UI, logos, or characters unless explicitly requested;
- structure art for parallax when the game uses layered backgrounds;
- keep foreground collision areas visually separable from decorative scenery;
- use the game's approved world palette and perspective.

## File Formats

Source masters:
- PNG by default
- transparent PNG for isolated sprites, props, icons, and UI when appropriate

Runtime exports:
- WEBP by default for web game runtime when supported
- PNG when transparency/quality requirements justify it

Print assets:
- PNG/PDF according to the game's print specification
- use print dimensions and bleed defined by the project

## Naming Convention

Use:

`game-slug_asset-type_asset-name_variant_version.ext`

Examples:
- `who-took-it_evidence_bong_v1.png`
- `who-took-it_evidence_lighter_v1.png`
- `seed-man-run_ui_play-button_default_v1.png`
- `seed-man-run_prop_checkpoint-sign_v1.png`
- `seed-man-run_bg_greenhouse-valley_v1.png`

Keep runtime filenames aligned with the game's manifest when a canonical filename already exists.

## Storage Workflow

For each approved asset:
1. Save the high-resolution/source master in the game's Drive visual asset structure.
2. Save or map the production source into the game's GitHub source asset folder when appropriate.
3. Create the optimized runtime export for the canonical repo runtime path.
4. Mirror the runtime asset into the site/public route when the game deployment architecture requires a site copy.
5. Update the game's asset manifest/backlog so the asset is no longer listed as missing.

Do not claim an asset is deployed unless the repo/site path has actually been updated.

## Quality Gates

General:
- correct asset identity
- no duplicate asset under another name
- no unintended text errors
- no malformed objects/anatomy
- no clipped edges
- no unwanted background when transparency is required
- visual style matches the approved game direction
- usable at target game scale

Cards:
- title text exactly matches the intended item name
- frame and margins match the set
- central object is unmistakable
- no accidental extra objects

Sprites:
- stable proportions
- stable anchor
- consistent facing direction
- no frame-scale drift
- transparent edges are clean
- animation reads at actual size

UI:
- text is readable
- state differences are obvious
- interaction targets remain legible on mobile/tablet/desktop

Backgrounds:
- correct aspect ratio
- no embedded UI/text unless requested
- supports gameplay readability
- parallax depth or layer intent is clear

## Default Production Priority

When no other priority is specified:
1. missing assets required for gameplay to function/read correctly
2. missing characters/enemies/items referenced by code
3. missing UI states and feedback assets
4. missing world/background art
5. missing terrain/props
6. branding/loading/marketing assets
7. optional polish variants

## Game-Specific Defaults

### Who Took It?
1. missing evidence/item cards
2. suspect-board frames
3. selected/eliminated/hidden states
4. reveal/result screens
5. digital UI assets

### Seed Man Run
1. missing runtime-referenced art
2. sprite source strips for approved character states/forms
3. enemy and boss source masters
4. terrain/interactive props
5. five canonical world backgrounds
6. HUD/menu/VFX
7. marketing art

### High Land
1. locked road-compatible world/location assets
2. hit-card assets
3. location art
4. board tokens/icons
5. packaging/promo

## Operational Rule

When the user says things like:
- "next"
- "continue"
- "keep building assets"
- "make the missing assets"
- "make multiple images at once"

Do not stop to ask which asset if the project's backlog/manifest already determines the next missing group. Audit the current state, choose the highest-priority missing batch, and produce it.

## Output Expectation

A successful pass should leave behind:
- individual usable assets rather than only a collage;
- a clear batch identity;
- consistent naming;
- stored source masters;
- runtime/site exports when applicable;
- an updated backlog/manifest showing what was completed and what comes next.
