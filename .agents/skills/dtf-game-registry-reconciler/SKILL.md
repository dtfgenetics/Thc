---
name: dtf-game-registry-reconciler
description: Detect and repair drift between the canonical DTF game-registry-v2 and deployment, navigation, source-map, asset, migration, or standalone-repo records. Use when counts, routes, owners, aliases, architecture, or release status disagree.
metadata:
  author: dtfgenetics
  version: "2.0.0"
---

# DTF Game Registry Reconciler

Use this skill whenever game records disagree.

## Primary authority

Always start with:
- `data/game-registry-v2.json`
- the matching game's canonical `gameDesignDoc` / source-of-truth

Then reconcile against:
- `data/game-source-map.json`
- `data/game-location-registry.json` during migration only
- `site/deployment/public-apps.json`
- `data/public-navigation.json`
- `data/game-asset-production-registry.json`
- standalone release-pin/integration manifests
- Dtf420 `lib/game-runtime-registry.ts` when migration copies matter

Normalize aliases through v2 before comparing IDs.

## Reconciliation checks

Find and repair:
- a specialized registry that points to a different owner/route than v2 without an explicit cutover;
- public/deployed games missing from v2;
- v2 public games missing from navigation/deployment records;
- migration/prototype copies mistaken for production;
- archived/deprecated paths used as release sources;
- stale candidate revisions or release notes;
- two repositories claiming active production ownership;
- integration snapshots being edited as canonical source;
- aliases or legacy IDs resolving to multiple games.

When a deliberate architecture/route/ownership change is made, update v2 first or in the same change, then reconcile specialized registries to the new reality.

## Verification

Run:
- `npm run games:registry:check`
- `npm run games:registry:docs:check`
- `npm run games:locations:check`
- relevant navigation/deployment/release validators

Definition of done: every shared fact resolves to one canonical identity and current owner/status after alias normalization.
