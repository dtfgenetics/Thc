---
name: dtf-game-runtime-quality
description: Improve DTF browser-game controls, mobile layout, accessibility, lifecycle behavior, performance, saves, replayability, rendering resilience, and shared-platform adoption without changing the game fantasy unnecessarily.
metadata:
  author: dtfgenetics
  version: "1.0.0"
---

# DTF Game Runtime Quality

Use after resolving the game with `dtf-game-location-resolver`.

## Audit dimensions

Check:
1. input abstraction and per-pointer ownership;
2. keyboard/touch/gamepad parity;
3. blur, hidden-tab, lost-pointer-capture and resume behavior;
4. safe-area/phone layout and touch targets;
5. reduced motion, contrast, UI scale and non-color cues;
6. audio unlock, category volumes, mute and cleanup;
7. deterministic RNG separation between gameplay and cosmetics;
8. save schema/version/migrations/export;
9. replay/debug reproducibility;
10. asset request/decode/GPU budgets;
11. long-animation-frame/frame pacing evidence;
12. Canvas/WebGL context loss/recovery;
13. fullscreen/orientation behavior;
14. offline/update strategy where a PWA/service worker exists;
15. external runtime dependency resilience.

## Reuse before duplication

Prefer `games/shared-platform/` for cross-game primitives. Promote proven implementations from existing games into shared code instead of writing a third version.

Known proven patterns:
- Seed Ascent: per-pointer capture + blur/visibility reset.
- PhenoQuest: safe-area layout, pointer capture, renderer cleanup.
- Shared platform: deterministic RNG, settings/accessibility, audio unlock, replay sanitization, telemetry privacy guards.

## Performance budgets

Do not stop at bytes. Measure or statically bound:
- initial critical requests;
- decoded image dimensions;
- approximate texture memory;
- atlas dimensions;
- audio duration/size;
- first playable state;
- long frames;
- renderer/context failures.

## Output

Implement the highest-impact runtime defects first, add deterministic checks where possible, then update shared platform contracts when 3+ games need the same behavior.
