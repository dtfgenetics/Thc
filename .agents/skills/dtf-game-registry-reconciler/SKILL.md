---
name: dtf-game-registry-reconciler
description: Detect and repair drift between DTF game source, deployment, navigation, asset, migration, and location registries. Use when counts, routes, owners, names, aliases, or production status disagree.
metadata:
  author: dtfgenetics
  version: "1.0.0"
---

# DTF Game Registry Reconciler

Use this skill whenever two project records disagree about where a game lives or whether it is public, deployable, archived, or in development.

## Inputs

Always inspect:
- `data/game-location-registry.json`
- `data/game-source-map.json`
- `site/deployment/public-apps.json`
- `data/public-navigation.json`
- `data/game-asset-production-registry.json`
- Dtf420 `lib/game-runtime-registry.ts` when migration copies matter

## Alias policy

Do not compare raw IDs until aliases are normalized. Examples:
- seed-man -> seed-man-platformer
- burn-buds -> protect-the-plants
- thc-crossword -> crossword
- kush-kings-chess -> kush-kings

Prefer one canonical portfolio ID and preserve old IDs as aliases/legacy references.

## Reconciliation checks

Find:
- source-map games absent from location registry;
- deployable game routes absent from source map;
- public navigation entries with no canonical owner;
- asset games that only differ by alias;
- two repositories both claiming production authority;
- runtime paths that point to archived scaffolds;
- public routes whose owner differs from deployment metadata;
- Dtf420 migration copies being mistaken for live authority;
- stale build/status notes;
- orphan projects such as deployable games missing from source/navigation registries.

Repair the smallest set of registries necessary to make current reality explicit. Do not erase historical aliases that are still needed for migration or redirects.

## Definition of done

All registries resolve the same canonical identity after alias normalization, and `npm run games:locations:check` passes.
