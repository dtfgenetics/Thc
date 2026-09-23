---
name: dtf-game-playtest-matrix
description: Build and execute a repeatable DTF game playtest matrix across devices, inputs, lifecycle states, network conditions, accessibility modes, and full start-to-finish gameplay.
metadata:
  author: dtfgenetics
  version: "1.0.0"
---

# DTF Game Playtest Matrix

Use deterministic tests first, then human/browser evidence where behavior is visual or interactive.

## Minimum matrix

For every playable game test:
- desktop keyboard/mouse;
- 360, 390, and 430 CSS-pixel phone widths;
- touch/pointer behavior;
- page blur/background/resume;
- restart/reset;
- win/loss/end state;
- reduced motion;
- forced/high contrast where supported;
- zoom/text scaling where DOM UI is used;
- audio unlock/mute/volume if audio exists;
- save/reload/recovery if persistence exists.

For real-time games also test:
- multi-touch;
- held input release;
- frame pacing under effects;
- pause/resume;
- fullscreen/orientation if supported.

For multiplayer also test:
- two independent sessions;
- invite/deep link;
- reconnect;
- disconnect during turn/action;
- stale room/session;
- rematch;
- mobile + desktop mixed pair.

## Evidence

Prefer deterministic Node/build/static checks for DTF repo QA. Do not use Playwright unless current explicit user direction restores it.

Record failures against canonical subsystem paths from the dossier.
