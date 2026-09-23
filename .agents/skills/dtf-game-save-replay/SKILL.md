---
name: dtf-game-save-replay
description: Design, repair, migrate, test, and debug DTF game persistence, checkpoints, profiles, deterministic seeds, replays, ghost/action logs, recovery, and export/import.
metadata:
  author: dtfgenetics
  version: "1.0.0"
---

# DTF Game Save + Replay

## Contract

- every persistent schema has an explicit version;
- migrations are deterministic and tested;
- renderer/DOM/scene objects never enter canonical saves;
- critical progress has a recovery/export path where practical;
- gameplay randomness records algorithm + seed/state when replay equivalence matters;
- replay logs record player intent/actions, not presentation noise;
- networked games keep server authority.

## Storage tiers

- localStorage: small preferences/light progression;
- IndexedDB: replay libraries, ghosts, larger saves/offline content;
- server: multiplayer identity/state and cross-device authoritative progression.

Never silently discard an old save solely because a schema changed.

## Tests

Require round-trip save/load, migration fixtures, corrupted-save handling, deterministic restart, replay equivalence where supported, and recovery after browser/tab interruption.
