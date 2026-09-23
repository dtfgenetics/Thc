---
name: dtf-game-performance-profiler
description: Profile and improve DTF browser-game loading, frame pacing, image decode/GPU memory, request count, texture/atlas usage, audio payload, lifecycle behavior, rendering resilience, and device quality tiers.
metadata:
  author: dtfgenetics
  version: "1.0.0"
---

# DTF Game Performance Profiler

Do not treat total file bytes as the whole performance budget.

## Measure

- critical request count before first playable state;
- JS/CSS/image/audio transfer bytes;
- decoded image dimensions;
- approximate GPU texture memory;
- atlas dimensions and wasted area;
- image/audio decode cost;
- first playable state;
- long animation frames / frame pacing;
- particles/effects cost;
- WebGL context loss/recovery;
- hidden-tab/background behavior;
- network polling/socket frequency;
- memory growth after restart/rematch;
- low/balanced/high quality tiers where useful.

## Asset guidance

Prefer normal cacheable binary assets over Base64 chunk assembly.
Use atlases when they reduce requests without creating oversized textures.
Use GPU-compressed textures only where they materially help and preserve fallbacks.

## Output

Record a before/after budget and add deterministic/static checks for dimensions, sizes, atlas constraints, and duplicate assets where practical.
