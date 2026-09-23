---
name: dtf-game-dossier-resolver
description: Resolve the exact subsystem files for a DTF game after its canonical location is known. Use to find rules, UI/rendering, data/content, assets, tests, scripts, server/network code, docs, workflows, deployment copies, and Dtf420 migration surfaces.
metadata:
  author: dtfgenetics
  version: "1.0.0"
---

# DTF Game Dossier Resolver

Read `data/game-location-registry.json` first, then `data/game-dossier-registry.json`.

## Purpose

The location registry answers **which project**.
The dossier registry answers **which files inside that project**.

Never begin a repair by grep-and-guess when the dossier already points to the relevant subsystem.

## Routing

Use the game's dossier fields:

- `subsystems.rulesAndSimulation` for engine/state/rules defects;
- `subsystems.uiAndRendering` for HUD/layout/render/scene work;
- `subsystems.dataAndContent` for cards/questions/levels/rosters/content;
- `subsystems.assets` for runtime art/audio/models;
- `subsystems.tests` for deterministic regression coverage;
- `subsystems.scripts` for build/generation/validation;
- `subsystems.serverAndNetwork` for APIs, rooms, sockets, presence, Colyseus, PHP backends;
- `subsystems.docs` for source-of-truth and release contracts;
- `subsystems.workflows` for game-specific CI.
- `development[]` for Dtf420 migration/prototype copies.

A path appearing in a dossier is a locator, not proof it remains correct forever. Verify current source before editing and update the dossier after moves/renames.

## Required behavior

1. Resolve alias -> canonical ID.
2. Resolve canonical repo and source roots.
3. Read the dossier.
4. Open the narrowest relevant subsystem paths.
5. Search adjacent files only when the dossier is incomplete.
6. When new important subsystem paths are discovered, update the dossier rather than relying on chat memory.
7. Run `npm run games:dossiers:check` after registry changes.
