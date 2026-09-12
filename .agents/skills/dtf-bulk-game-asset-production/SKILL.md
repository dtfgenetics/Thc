---
name: dtf-bulk-game-asset-production
description: Batch-produce multiple individual visual game assets in one production pass. Use when the user asks to make many game images/assets at once, continue visual asset production, fill missing art, create a set of cards/props/items/enemies/backgrounds/UI pieces, or maximize image generation throughput while keeping every output as its own full-resolution file. Audits existing Drive/GitHub/site assets first, avoids duplicates, generates the largest supported batch, preserves visual consistency, and routes approved outputs into canonical storage/runtime paths.
compatibility: DTFSeeds game projects, dtfgenetics/Thc integration repo, canonical game repositories, Google Drive asset libraries, ChatGPT image generation, Codex/game-studio workflows.
metadata:
  owner: DTF Genetics
  status: active
  version: 1.0
  updated: 2026-09-12
---

# DTF Bulk Game Asset Production

Use this skill when the goal is to create **multiple individual visual assets in one production run** instead of generating one image at a time.

The defining behavior is:

> One batch request -> many separate full-resolution image files -> canonical storage -> manifest/runtime integration.

A collage, contact sheet, mood board, or poster does **not** count as a batch of individual production assets unless the user explicitly asks for a collage/reference sheet.

## Primary outcomes

This skill must:

1. identify which visual assets are genuinely missing;
2. avoid recreating assets that are already approved or usable;
3. generate the largest practical number of independent images in one image-generation call/batch;
4. keep every generated asset as a separate file;
5. preserve a shared visual language across the batch;
6. name each file deterministically;
7. store source masters and runtime exports in the correct Drive/GitHub/site locations;
8. update the relevant asset manifest/backlog;
9. distinguish concept/review art from runtime-ready art;
10. continue immediately with the next missing batch when asked to continue.

## Trigger phrases

Use this skill for requests such as:

- "make game assets we don't already have"
- "make multiple images at once"
- "make 10 assets at a time"
- "max out the image generation"
- "make the next set"
- "keep building the visual assets"
- "create the missing cards"
- "make all the enemies/items/props/backgrounds"
- "make individual full-page/full-resolution images"
- "place them in Drive, GitHub, and the site"

## Mandatory first step: audit before generating

Before creating a batch:

1. Resolve the game/project and canonical repository/path.
2. Read the game asset manifest, production backlog, source-of-truth docs, and relevant Drive folder structure.
3. Inspect existing approved/source/review assets.
4. Build a missing-asset queue.
5. Remove from that queue anything already complete, approved, duplicated, superseded, or incompatible with the current design direction.
6. Rank remaining assets by gameplay importance:
   - P0: required to make the game readable/playable;
   - P1: required for complete visual identity/content;
   - P2: polish/marketing/secondary variants.

Never generate random assets merely to fill a batch count.

## Batch-size rule

Use the **largest supported multi-output batch** available from the current image-generation tool.

When ChatGPT/image generation exposes an `n`, count, batch, or multi-image parameter:

- request multiple outputs in one call;
- prefer the maximum supported count when the user explicitly says to make as many as possible;
- otherwise target 4-10 related assets per batch when supported;
- do not fake a multi-image batch by composing all requested assets into a single sheet.

If the tool supports fewer images than requested, generate the maximum supported amount now and continue in the next batch when the user says continue.

## Independent-output rule

Every requested production asset must be its own file.

Correct:

```text
who-took-it-bong-evidence-card-v1.png
who-took-it-lighter-evidence-card-v1.png
who-took-it-grinder-evidence-card-v1.png
who-took-it-ashtray-evidence-card-v1.png
```

Incorrect:

```text
who-took-it-evidence-sheet-with-four-cards.png
```

Reference/contact sheets may be generated additionally for review, but they must never replace the individual source assets.

## Batch coherence contract

All assets in one batch must share a production specification before generation.

Lock these properties:

- game/project;
- visual style;
- camera/view angle;
- rendering treatment;
- outline treatment;
- lighting family;
- palette family;
- frame/border template where applicable;
- typography rules where applicable;
- aspect ratio;
- target dimensions;
- transparency/background rule;
- subject scale and safe margins;
- naming pattern;
- intended runtime use.

Change only the subject-specific content unless a deliberate variant is required.

## Asset classes

### Cards and printable components

Generate each card separately at production resolution.

Lock:

- exact card ratio;
- border/frame template;
- title placement;
- safe area;
- bleed requirements when known;
- consistent font treatment;
- consistent object scale;
- no sheet slicing as the source master.

For card sets, keep the template constant and vary only the subject/title/content.

### Props, items, collectibles, icons

Default to:

- transparent background;
- centered subject;
- full object visible;
- consistent three-quarter or front view;
- generous padding;
- no labels unless labels are part of gameplay;
- no decorative scenery.

### Characters and enemies

Default to transparent PNG source masters.

For static character sets:

- same scale family;
- same camera angle;
- same light direction;
- readable silhouette;
- no cropped limbs/props unless intentional.

For animation, use the dedicated sprite workflow rather than independent frame generation:

1. start from one approved in-game seed frame;
2. generate a whole animation strip in one request;
3. keep the same character, facing, palette, silhouette, and proportions;
4. normalize to fixed frame size;
5. align all frames to one shared anchor, normally bottom-center;
6. preview before replacing runtime atlases.

Do not generate animation frames independently when visual continuity matters.

### Backgrounds and environments

Generate backgrounds as separate wide source masters, not as tiny thumbnails in a sheet.

Lock:

- target aspect ratio;
- horizon/gameplay plane;
- parallax readability;
- foreground/midground/background separation;
- space for gameplay silhouettes;
- no UI/text/characters unless explicitly needed.

Where parallax layers are required, create independent layer files rather than baking everything into one flat image.

### UI and VFX

For UI sets:

- preserve one design system;
- produce default/hover/pressed/disabled states when required;
- keep touch/readability constraints;
- export individual components.

For VFX:

- transparent background when possible;
- consistent frame bounds;
- no unrelated scenery;
- generate strips/sequences when animation is required.

## Source master vs runtime export

Never confuse generated source art with deployable runtime art.

Default separation:

```text
Drive / Source Masters -> original PNGs / print masters / working art
GitHub / source assets -> canonical source copies when repository policy allows
GitHub / approved runtime -> optimized WebP/PNG/atlas/texture outputs only after approval
Site / public route -> runtime copy referenced by the live build
Drive / Review -> concept sheets, rejected versions, comparison sheets
```

Concept sheets belong in review/reference storage unless specifically promoted.

## Recommended project folders

When no game-specific convention overrides this, use:

```text
00 Reference/
01 Source Masters/
02 Characters/
03 Enemies & Bosses/
04 World Art/
05 Terrain & Props/
06 UI & VFX/
07 Runtime Exports/
99 Review/
```

Do not create duplicate folder trees if the game already has an established structure.

## Naming convention

Use lowercase kebab-case for web/runtime files unless the canonical project specifies otherwise.

Pattern:

```text
<game>-<asset-class>-<subject>-v<number>.<ext>
```

Examples:

```text
who-took-it-evidence-bong-v1.png
who-took-it-evidence-grinder-v1.png
seed-man-run-enemy-root-crawler-v1.png
seed-man-run-world-greenhouse-valley-v1.png
high-land-hit-card-move-forward-3-v1.png
```

Do not use filenames such as:

```text
image.png
final.png
final-final.png
asset-new.png
```

## Prompt construction for a multi-image batch

Create one shared batch specification, then provide a clearly ordered asset list.

Template:

```text
Create N SEPARATE INDIVIDUAL images, one file per listed asset. Do not combine them into a collage, grid, contact sheet, poster, sprite sheet, or multi-panel page.

PROJECT: <game>
ASSET TYPE: <type>
STYLE LOCK: <approved visual direction>
FORMAT: <PNG/WebP/source>
CANVAS: <dimensions/aspect>
BACKGROUND: <transparent/scene/template>
COMPOSITION: <shared composition rule>
CONSISTENCY: identical frame/border/rendering/light/palette treatment across every output

OUTPUTS:
1. <asset id/name> — <specific visual description>
2. <asset id/name> — <specific visual description>
...
N. <asset id/name> — <specific visual description>

Critical: return N independent image outputs/files, not one combined sheet.
```

## Full-resolution rule

When the user asks for full-page/full-size assets:

- request the largest useful supported resolution for the required aspect ratio;
- preserve the correct final aspect ratio instead of stretching later;
- do not upscale a tiny contact-sheet crop and call it a source master;
- for print assets, preserve sufficient source resolution and bleed/safe zones;
- for browser runtime, derive optimized exports from the source master rather than replacing the master.

## Duplicate prevention

Before every batch, compare proposed IDs/names against:

- Drive filenames/folders;
- GitHub asset directories;
- asset manifests;
- production backlogs;
- site/public runtime assets;
- prior review batches.

If an asset exists but is low quality, mark it as `replace` or `upgrade`; do not call it missing.

Statuses:

```text
missing
queued
generating
review
approved
runtime-exported
integrated
replace
rejected
```

## Manifest update

Every production batch should leave a machine-readable record when the project supports manifests.

Recommended entry:

```json
{
  "id": "who-took-it-evidence-bong",
  "kind": "evidence-card",
  "status": "review",
  "source": "assets/evidence/source/who-took-it-evidence-bong-v1.png",
  "runtime": null,
  "driveId": null,
  "batch": "2026-09-12-evidence-01",
  "version": 1
}
```

After approval/runtime conversion, update the same record rather than creating ambiguous duplicate entries.

## Drive placement workflow

When Drive is available:

1. resolve the canonical game folder;
2. use the existing subfolder structure or create the missing controlled folders;
3. upload each generated image separately;
4. use its deterministic production filename;
5. keep concept/review images in `99 Review`;
6. keep source masters in their asset-class/source folder;
7. record Drive IDs in the production manifest when useful.

## GitHub placement workflow

Generated image bytes must only be committed when the connector/runtime supports binary asset writes safely.

When binary commits are supported:

1. place source and runtime art in their canonical paths;
2. preserve the existing asset manifest/registry keys;
3. update paths and manifests in the same logical change;
4. do not replace approved runtime art before the new file passes review/validation.

When binary writes are not supported by the current tool surface:

- upload source assets to Drive;
- record exact intended repository/site paths in the manifest/backlog;
- do not claim GitHub/site placement completed until the binary file actually lands.

## Site/runtime integration

An image existing in Drive is not the same as the game using it.

Runtime integration requires:

1. optimized runtime format;
2. canonical repository asset path;
3. manifest/registry entry;
4. code/CSS/runtime reference when needed;
5. production/public-route copy when the architecture requires one;
6. deterministic tests/build validation;
7. live-route verification after deployment.

Never claim an asset is live merely because it was generated or uploaded.

## Quality gates per image

Reject/regenerate an individual asset if any of these fail:

- wrong subject;
- duplicate of another batch item;
- malformed hands/limbs/object geometry that harms readability;
- cropped required content;
- inconsistent border/template;
- inconsistent palette/render style;
- illegible or misspelled required text;
- wrong aspect ratio;
- unintended background when transparency is required;
- visible sheet/grid artifacts;
- inconsistent scale that prevents use with the rest of the set.

A strong batch may contain one failed image; regenerate the failed item instead of discarding good outputs.

## Accuracy rule for text-heavy assets

Image-generation typography must be verified manually/visually.

For cards, boards, UI, labels, signs, educational graphics, or anything where exact wording matters:

- verify every word;
- verify spelling and capitalization;
- verify numbers;
- verify icons/symbols;
- prefer programmatic text overlay/layout when exact text reliability is critical.

Do not accept a visually attractive asset with incorrect required text.

## Throughput strategy

For large projects, process asset families instead of random cross-game batches.

Recommended order:

1. missing core gameplay art;
2. characters/enemies/items required by mechanics;
3. environments/backgrounds/terrain;
4. gameplay UI states;
5. cards/components;
6. VFX/feedback;
7. branding/loading/title art;
8. marketing/promotional art.

Keep one batch visually homogeneous whenever possible. Ten evidence cards together are better than one evidence card, one enemy, one background, one logo, and six unrelated pieces.

## Batch ledger

Track at least:

```text
batch_id
game
asset_family
requested_count
generated_count
accepted_count
rejected_count
source_folder
runtime_folder
repo_path
site_path
manifest_path
notes
```

This prevents losing generated work or repeating completed assets.

## Continuation behavior

When the user says `continue`, `next`, `next set`, or equivalent:

1. read the current batch ledger/manifest;
2. skip completed assets;
3. select the next highest-priority missing homogeneous group;
4. generate the largest supported multi-image batch;
5. store and register the outputs;
6. move immediately to the next queue state without asking the user to restate the project.

## Interaction with other DTF skills

Use with:

- `dtf-game-production` for overall game implementation;
- `dtf-game-portfolio-upgrade` for choosing which games/assets need work first;
- `dtf-game-canonical-release` for validated integration/release;
- `dtf-web-quality-gate` for site/runtime visual verification;
- game-specific skills for locked visual rules and mechanics.

For 2D sprite animation, use the full-strip/normalization workflow rather than generic independent image batching.

## Definition of done for a batch

A batch is complete only when:

- each requested asset exists as its own independent file;
- files are named correctly;
- no obvious duplicates were created;
- shared visual style is consistent;
- required text is accurate;
- source assets are stored in the correct location;
- review-only work is clearly labeled as review-only;
- manifest/ledger is updated;
- intended repo/site paths are recorded;
- runtime/live claims are made only when actual integration/deployment is verified.

## Required completion report

After a bulk production run, report concisely:

- game/project;
- asset family;
- number requested/generated/accepted;
- filenames created;
- Drive location;
- GitHub/runtime placement status;
- manifest/ledger update;
- failed/regeneration items, if any;
- next missing batch.

Do not substitute a contact sheet for the requested independent files and do not count concept art as integrated runtime art.
