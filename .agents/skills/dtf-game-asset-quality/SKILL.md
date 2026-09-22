---
name: dtf-game-asset-quality
description: Validate and improve DTF game-art production beyond file placement: visual consistency, sprite anchors, animation families, world layers, texture/decode budgets, runtime manifests, provenance, optimization, and live in-engine verification.
metadata:
  author: dtfgenetics
  version: "1.0.0"
---

# DTF Game Asset Quality

Use with `dtf-game-asset-ingest`; ingest proves placement, this skill proves runtime quality.

## Asset acceptance layers

An asset is not production-complete merely because it exists or is integrated.

Validate:
- correct game/character visual bible;
- identity continuity across views/states;
- transparent bounds and consistent anchors;
- animation frame dimensions/order;
- silhouette/readability at game scale;
- no baked UI text unless required;
- no color-only state meaning;
- intended alpha/opaque format;
- source-master provenance/checksum;
- runtime filename/manifest key;
- decoded dimensions and texture-memory estimate;
- atlas size and packing efficiency;
- in-engine crop/scale/filtering;
- mobile and desktop visibility;
- no missing/fallback asset at runtime;
- exact live-route rendering after publication.

## Seed Man warning

The locked classic short oval Seed Man and the legacy green-armored runtime contract are different identities. Do not approve an asset family until the manifest/runtime guard and the approved character contract agree.

## Automation to add

Where practical, add deterministic validators for:
- image dimensions/alpha;
- sprite-sheet frame divisibility;
- anchor metadata;
- maximum atlas dimensions;
- duplicate checksums;
- manifest paths;
- orphaned runtime files;
- missing source-master receipt;
- oversized decoded texture estimates;
- missing animation states.

Human visual review remains required for composition and identity quality.
