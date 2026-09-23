---
name: dtf-game-source-archaeology
description: Trace duplicate, legacy, prototype, migration, packaged, and archived copies of a DTF game and determine what each copy is for before consolidating or deleting anything.
metadata:
  author: dtfgenetics
  version: "1.0.0"
---

# DTF Game Source Archaeology

Use when a title exists in multiple repos/folders, old code resurfaces, or ownership is unclear.

## Evidence order

1. `data/game-location-registry.json`
2. `data/game-dossier-registry.json`
3. `data/game-source-map.json`
4. deployment/public-navigation registries
5. current repository trees and recent commits
6. Drive Games Folder Map / project tracker as historical routing evidence
7. old README/docs only after newer machine registries

## Classify every copy

Label it one of:
- production-authority
- canonical-source
- integration/package
- migration
- prototype
- compatibility-route
- generated-build
- verified-snapshot
- merged-history
- archive
- concept/reference

Do not delete or rewrite a duplicate until its unique data/assets/tests are compared.

## Deliverable

Record:
- why copies differ;
- what unique features/assets/data each contains;
- current production owner;
- what should be merged, retained, redirected, or archived;
- exact tests needed before retiring a copy.

Update the location/dossier registries after reconciliation.
