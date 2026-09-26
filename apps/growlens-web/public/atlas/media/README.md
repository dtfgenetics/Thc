# THC Living Plant Atlas — Production Media

This directory contains approved public-facing Plant Atlas visual assets referenced by `/atlas/data/media-registry-v1.json`.

Rules:

- Raster-first instructional media only: PNG, WebP, JPEG.
- Do not place unreviewed drafts in this public directory.
- Every public asset must be registered with `npm run atlas:media -- register <asset-json-file>`.
- The registry entry must include source, creator, license, capture type, plant stage, organ/tissue and whether the image is illustrative or measured.
- Microscopy used as measured evidence must record scale or magnification when known and must not be AI-generated.
- Keep source and public-route mirrors byte-identical.
- Use entity subdirectories, for example:
  - `/atlas/media/leaf-module/`
  - `/atlas/media/stomatal-surface/`
  - `/atlas/media/root-system/`
  - `/atlas/media/flower-anatomy/`
  - `/atlas/media/trichomes-resin/`

Do not mark a media record approved until every required asset class for that entity has an approved registered asset.
