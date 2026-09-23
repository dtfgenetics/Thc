---
name: dtf-game-content-pipeline
description: Build and validate scalable DTF game content pipelines for questions, cards, decks, strains, levels, puzzles, encounters, prompts, locations, enemies, items, and educational game data.
metadata:
  author: dtfgenetics
  version: "1.0.0"
---

# DTF Game Content Pipeline

Use when a game's content scale is larger than safe manual editing.

## Separate

Keep:
- canonical content/data;
- gameplay engine;
- presentation;
- private/hidden answer data;
- generated runtime bundles;
- print/export artifacts

as distinct layers where the game requires them.

## Validators

Add schema validation, unique IDs, duplicate detection, reference integrity, category/difficulty distribution, deterministic generation, content count checks, and private-data exclusion.

Educational claims need source/provenance controls appropriate to the content.

## Authoring tools

Prefer scripts/CLI/importers that generate validated runtime data from canonical sources over hand-editing multiple mirrored copies.

When runtime and canonical data are mirrored, enforce byte/content equivalence or one-way generation.
