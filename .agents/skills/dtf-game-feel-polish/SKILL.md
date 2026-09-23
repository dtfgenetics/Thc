---
name: dtf-game-feel-polish
description: Improve DTF game feel through coordinated animation, anticipation, impact feedback, particles, camera motion, audio cues, HUD feedback, transitions, timing, and reduced-motion-safe alternatives.
metadata:
  author: dtfgenetics
  version: "1.0.0"
---

# DTF Game Feel Polish

Polish should reinforce gameplay state, not hide weak mechanics.

## Feedback stack

For an important action, evaluate:
1. anticipation/readability;
2. gameplay state change;
3. character/object animation;
4. particles/VFX;
5. sound;
6. camera impulse or board motion;
7. HUD/status update;
8. short recovery/confirmation.

Use only the layers appropriate to the game.

## Examples

- board move: token movement + space pulse + subtle sound + event text;
- attack/hit: wind-up + impact frame + particles + sound + health feedback;
- card reveal: anticipation + flip/reveal + category sound + result emphasis;
- correct trivia answer: immediate semantic result + score movement + restrained celebration;
- multiplayer turn: clear ownership transition + audible/visual notification.

Respect reduced-motion settings and never make camera shake or flashes mandatory for understanding state.

Prefer the current engine's native animation/audio/effects stack before adding another runtime dependency.
