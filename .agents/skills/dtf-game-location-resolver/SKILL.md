---
name: dtf-game-location-resolver
description: Use when an older DTF game workflow asks for game location or ownership resolution. Compatibility wrapper for the canonical dtf-game-development workflow.
metadata:
  author: dtfgenetics
  version: "2.0.0"
---

# DTF Game Location Resolver

This compatibility skill no longer maintains an independent game-location policy.

**REQUIRED SKILL:** Use `dtf-game-development`.

Read `data/game-registry-v2.json`, resolve the requested title through `aliasMap`, and follow the mandatory preflight in `.agents/skills/dtf-game-development/SKILL.md`.

The legacy `data/game-location-registry.json` remains available during migration but is not the new portfolio authority. If v1 and v2 conflict, investigate and reconcile the records before implementation.
