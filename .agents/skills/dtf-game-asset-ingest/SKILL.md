---
name: dtf-game-asset-ingest
description: Save newly generated DTF game images into the correct Google Drive, GitHub, and site/runtime locations. Use whenever the user says save, store, place, upload, commit, push, archive, organize, or put game assets in the correct location.
---

# DTF Game Asset Ingest

## Purpose

Turn generated images into properly stored, versioned, deployable game assets.

This skill complements `dtf-batch-game-asset-production`. That skill creates the art. This skill is responsible for locating the correct game, resolving the canonical storage paths, normalizing filenames, uploading source masters, committing runtime assets, updating manifests, and verifying that the files actually landed.

## Non-Negotiable Rule

Never claim an asset is saved, committed, pushed, deployed, or live until the destination has been read back and verified.

A local `/mnt/data` staging path is not Drive and is not GitHub.
A ZIP prepared for upload is not an uploaded asset.
A created Git blob is not committed until the branch ref points to a commit containing it.

## Trigger Phrases

Use this skill automatically when the user says things such as:
- save these images
- save them in the correct location
- put these in the Drive and repo
- upload the assets
- place the assets where they belong
- commit these images
- push the images
- organize these game assets
- save this batch
- archive this batch
- wire these assets into the game

Do not ask the user to repeat a game name when the active game is already clear from the conversation.

## Storage Architecture

### Google Drive = source-master authority

Store here by default:
- original generated PNGs
- full-resolution card art
- transparent source masters
- print-resolution files
- editable/export masters
- review/reference art
- alternate approved variants

Do not downsample the only source master.

### GitHub = production/runtime authority

Store here by default:
- optimized WebP/PNG runtime images
- sprites actually referenced by code
- UI assets actually referenced by code
- site/public assets
- asset manifests and metadata
- small production-ready source assets only when the repo architecture explicitly expects them

Avoid committing dozens of 2–5 MB high-resolution source PNGs solely as backup. Drive is the source-master repository. This prevents unnecessary repository growth and slower clones/builds.

### Site/public folders = deployment copies

Only place an asset in a public/runtime path when:
- code or a manifest references it, or
- the site architecture explicitly mirrors game assets there.

Do not dump unused art into public folders.

## Required Location Registry

Before ingesting, read `.agents/skills/dtf-game-asset-ingest/asset-locations.json` when available.

The registry records:
- canonical game name
- aliases
- GitHub repository
- default branch
- Drive game-root folder ID
- known Drive asset folders
- repo source paths
- repo runtime paths
- public/site mirror paths
- manifest paths

If the game is missing from the registry, discover the locations, verify them, then add the game to the registry for future passes.

Never trust an old registry entry blindly. Confirm the destination still exists before writing.

## Phase 1 — Resolve the Active Game

1. Determine the active game from the current conversation/project.
2. Resolve aliases to one canonical game ID.
3. Load the registry entry.
4. If no entry exists, search GitHub and Drive using the exact game name and known aliases.
5. Confirm the repo by reading its README, manifest, game data, or existing asset tree.
6. Confirm the Drive root by listing its immediate folders.

Do not place art into a general/shared folder when a game-specific folder exists.

## Phase 2 — Inspect Existing Asset Contracts

Before saving anything, inspect:
- the game's repo asset directories;
- any production/art manifest;
- runtime asset map or JSON mapping;
- public/site asset directories;
- the game's Drive art/component folders.

Determine for every asset class:
- source-master destination;
- runtime destination;
- required filename;
- whether the asset is currently referenced by code;
- whether a public/site mirror is required.

Canonical runtime filenames and manifest-defined IDs override generic naming conventions.

## Phase 3 — Inventory the Generated Batch

1. Enumerate actual image files produced in the current session/runtime.
2. Do not assume the user's stated count is exact.
3. Match filenames to visual labels or intended asset names.
4. Compute a SHA-256 checksum for each local file when practical.
5. Detect exact duplicates by checksum.
6. Detect obvious semantic duplicates by filename/title.
7. Keep the actual count; never manufacture extra assets merely to match an estimated number.
8. Exclude contact sheets/concept boards unless they were explicitly requested as production assets.

## Phase 4 — Normalize Filenames

Default source-master pattern:

`game-slug_asset-type_asset-name_variant_version.png`

Examples:
- `who-took-it_evidence_lighter_v1.png`
- `seed-man-run_enemy_sproutling_idle_v1.png`
- `high-land_location_rolling-hills_v1.png`

Rules:
- lowercase
- hyphenate multiword asset names
- keep the game slug stable
- include version when the file may be replaced later
- never rename a runtime file away from a canonical manifest-defined filename without updating the manifest/code in the same ingest

## Phase 5 — Save Source Masters to Drive

1. Resolve the exact game-specific Drive asset folder.
2. Create missing subfolders only when they fit the established game structure.
3. Upload each source master using its normalized filename.
4. Record returned Drive file IDs and URLs.
5. After all uploads, list the destination folder.
6. Compare the actual destination filenames against the intended batch.
7. Confirm count and file sizes.
8. Retry individual failures; do not re-upload successful files unnecessarily.

Drive verification passes only when every intended source-master filename appears in the destination.

## Phase 6 — Prepare Runtime Assets

Only create runtime exports for assets required by the game/site.

Runtime preparation rules:
- follow the game's manifest dimensions/aspect ratio;
- preserve transparency when required;
- prefer WebP for web runtime when supported;
- do not upscale low-resolution art merely to meet a nominal dimension;
- keep source masters untouched;
- visually inspect generated exports when conversion could affect quality.

For printed card art, keep the full-resolution PNG in Drive even when a smaller WebP is used digitally.

## Phase 7 — Commit Binary Assets to GitHub

For binary images, use the Git data workflow rather than pretending text-file tools uploaded them:

1. Read the target branch and capture its current commit SHA and tree SHA.
2. Base64-encode each runtime binary locally.
3. Create a Git blob for each binary with `create_blob` using base64 encoding.
4. Build one tree containing all asset paths using `create_tree`, based on the current branch tree.
5. Include manifest/registry updates in the same tree when practical.
6. Create one commit with the previous branch commit as parent.
7. Move the branch ref to the new commit using `update_ref` without force when it is a fast-forward.
8. Re-fetch the destination directory and the commit.
9. Confirm every intended path exists on the branch.

For large batches, split into manageable commits if connector/tool payload size becomes excessive, but keep each batch logically atomic.

Do not stop at `create_blob`; blobs that are not in a tree/commit/ref are not saved to the branch.

## Phase 8 — Update Runtime Manifests and Code Mappings

When the game has an asset manifest:
- add/update the asset entry;
- preserve canonical item IDs;
- mark status `approved` only after the actual file exists;
- point runtime mappings to the real filename;
- never substitute a vaguely related asset for a canonical required asset;
- keep unrelated source-only art out of runtime mappings.

If code currently expects only a subset of a larger art set, store the full source set in Drive but wire only the canonical runtime subset into the app.

## Phase 9 — Site/Public Mirror

If the game deployment architecture requires a mirrored site/public asset:
1. identify the canonical public path;
2. mirror the runtime export there in the same or a follow-up atomic commit;
3. verify the file exists at the public path;
4. run deterministic build/static route checks when available.

Do not use Playwright for DTF game QA unless the user explicitly restores it. Prefer deterministic build, route, manifest, and asset-reference checks.

## Phase 10 — Verification Receipt

Every completed ingest batch should leave a receipt, preferably JSON, under a game-appropriate path such as:

`assets/ingest-receipts/YYYY-MM-DD_<batch-id>.json`

Receipt fields:
- game ID
- batch ID
- timestamp/date
- asset logical name
- source filename
- source checksum
- Drive file ID
- Drive folder ID
- repo runtime path
- repo source path if one exists
- site/public path if mirrored
- Git blob SHA
- Git commit SHA
- manifest entry/ID
- verification status

A receipt makes later audits deterministic and prevents repeated uploads.

## Success Criteria

Only say the batch is saved when all required checks pass:

### Drive
- destination folder exists;
- every intended source-master filename is listed;
- returned file IDs are recorded;
- file sizes are non-zero.

### GitHub
- target branch points to the new commit;
- every intended runtime path appears in the repository;
- manifest references match actual filenames;
- no asset is marked approved without a corresponding file.

### Site/runtime
- required public asset paths exist;
- code/manifest references resolve;
- deterministic build/static asset checks pass when available.

If only Drive is complete, say `Drive saved; GitHub pending`.
If only GitHub is complete, say `GitHub committed; Drive pending`.
Never collapse partial completion into `done`.

## Failure Recovery

If an upload/write fails:
1. inspect which individual assets succeeded;
2. retry only missing assets;
3. verify again;
4. do not create duplicate Drive copies unless a new version is intentional;
5. if the GitHub branch advanced during the ingest, re-read the branch, rebuild the tree from the latest tree, and create a new fast-forward commit.

## Better-Than-Duplicate Storage Policy

Preferred hierarchy:
1. Drive full-resolution source master
2. GitHub optimized runtime export
3. site/public copy only when required by deployment
4. manifest/receipt linking all three

Do not automatically keep identical full-resolution copies in Drive, GitHub source, and site/public folders. Store each representation where it serves a purpose.

## Operational Shortcut

When the user says `save these in the correct location`:

1. identify active game;
2. load registry;
3. inventory actual new files;
4. inspect manifest/runtime needs;
5. upload source masters to Drive;
6. produce runtime exports only where needed;
7. commit binaries + manifest changes to GitHub;
8. mirror public assets if required;
9. verify Drive and GitHub by reading them back;
10. report the actual count and commit/folder evidence.

Do the work without asking where to put the files when the canonical locations can be discovered from the project.
