---
name: dtf-game-asset-production
description: Plan, generate, organize, normalize, integrate, validate, and release visual/audio assets for DTFSeeds games using the game-specific Google Drive asset library and canonical GitHub runtime.
---

# DTF Game Asset Production

## Read first

1. `docs/GAME_ASSET_PRODUCTION_MASTER.md`
2. `data/game-asset-production-registry.json`
3. `data/project-registry.json`
4. the owning game's source-of-truth/readme/asset manifest
5. the current Drive master tracker: `DTF Games — Visual Asset Master Tracker`

For 2D sprite animation also use the Game Studio sprite-pipeline workflow. For 3D shipping also use the web 3D asset pipeline.

## Objective

Move an asset from a clearly defined need to a verified production runtime without losing the source master or confusing concept art with approved art.

## Source ownership

- Google Drive stores source masters, approved masters, print masters, reference sheets, audio masters, marketing art and provenance/review material.
- GitHub stores optimized runtime files, manifests, path mappings, code, tests and deployment integration.
- Game-specific assets belong under `04 Games/<Game>/08 Visual Assets` in Drive.
- `04 Games/00 Shared Game Assets` is only for genuinely reusable portfolio assets.

## Standard Drive tree

```text
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

## Production workflow

### 1. Resolve the game
Confirm canonical repository, public route, Drive game folder, visual root, existing approved/source assets, active asset manifest/runtime mapping and current batch ID. Do not infer approval from filename alone.

### 2. Define one coherent batch
Default batch = 10 assets. Record batch ID, exact outputs, source/reference, dimensions/aspect, alpha needs, Drive destination, runtime destination, dependencies and acceptance criteria. Do not mix unrelated games or unrelated families to reach ten.

### 3. Generate or author source masters
Follow the game's visual bible/reference. Global expectations: professional game-studio finish, no yellow cast, no watermark, stable visual identity, avoid baked-in body copy when runtime text can be used, and source masters large enough for print/social/runtime reuse.

For Seed Man, preserve the approved character identity and proportions unless a newer explicit user direction changes them.

### 4. Store source immediately
Put source masters into the correct game-specific Drive folder before runtime optimization. Use `01 Source Masters` for high-resolution working masters, category folders for organized working sets, `02 Approved Masters` after approval, and `99 Archive` for superseded versions. Update the master tracker.

### 5. Approval gate
Use `NEEDED → CONCEPT → REVIEW → APPROVED → NORMALIZED → OPTIMIZED → INTEGRATED → VERIFIED-LIVE`. Only APPROVED or later assets may become active production art.

### 6. Normalize
For sprites, normalize frames to one scale and consistent bottom-center anchor; preview whole animation before atlas integration. For cards/UI, standardize safe areas and crop behavior and do not rely only on color for state. For 3D, apply transforms, stabilize pivots, create collision proxies where needed, optimize geometry/materials/textures and prefer GLB/glTF.

### 7. Create runtime exports
Place web-ready exports in Drive `11 Runtime Exports`, then promote the exact optimized files into the owning GitHub runtime path. Typical targets: WebP/AVIF for opaque art, WebP/PNG for alpha, SVG for vector UI, GLB/glTF for 3D and browser-supported compressed audio formats.

### 8. Update manifests and code
Every active runtime asset must have a stable ID/path mapping. Update the owning asset manifest or add one when the game lacks it. Do not leave production code guessing filenames when a deterministic manifest is practical.

### 9. Validate
Minimum evidence: source master exists in Drive; approval state recorded; runtime export exists; manifest resolves to file; no referenced runtime file is missing; game build/tests pass; asset is readable at game scale; phone widths 360/390/430 and desktop checked for relevant UI/art; no accidental placeholder or retired art remains active.

Use deterministic Node/static/build tests as the routine automated baseline. Browser/live visual review is a separate evidence step.

### 10. Integrate and release
Use the canonical repository/release lane for the owning game. After deployment, verify the exact public route and expected asset version/marker. Only then set VERIFIED-LIVE in the tracker.

## Priority order
Wave 1: Seed Man `SM-001`; Who Took It `WTI-001`; High Life `HL-001`; High IQ `HIQ-001`; Terpocalypse `TERP-001`; Bud or Bluff `BOB-001`.

Wave 2: High Land, Weedopolis, Strain Showdown, Burn Buds.

Wave 3: remaining public portfolio.

Wave 4: Ganjumanji and THC RPG.

## Definition of done
An asset family is not done at generation. It is done only when source storage, approval, normalization, optimization, manifest mapping, runtime integration, deterministic validation, game-scale review and exact live-route verification have all been completed.
