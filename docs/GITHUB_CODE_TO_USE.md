# GitHub Code To Use

This file lists the public codebases that should guide this project. Do not copy blindly. Use permissive sources, preserve licenses/notices when code is copied, and adapt the architecture to this game.

## Best primary starter

### phaserjs/template-vite-ts

URL: https://github.com/phaserjs/template-vite-ts

Use for:

- Vite + TypeScript project structure
- Phaser bootstrapping
- build/dev scripts
- static asset loading pattern

Why:

- It is an official Phaser template.
- It uses TypeScript and Vite.
- It has an MIT license.

Notes:

- The official template includes optional telemetry scripts in its package scripts. This repo should not copy that behavior. Keep scripts simple.

## Best multiplayer reference

### colyseus/tutorial-phaser

URL: https://github.com/colyseus/tutorial-phaser

Use for:

- client/server folder split
- Phaser client connecting to a WebSocket game server
- room/state concepts
- future online multiplayer structure

Why:

- It is a Phaser + Colyseus tutorial.
- It includes both client and server folders.
- Source code is MIT licensed.

Do not add multiplayer before local gameplay is stable.

## Alternative turn-based engine reference

### boardgame.io

URL: https://github.com/boardgameio/boardgame.io

Use for:

- turn-order concepts
- move validation concepts
- lobby/matchmaking ideas
- rules-first thinking

Why not primary:

- It is excellent for state and turn-based board games.
- It is not the best visual/animation layer for a custom animated board path.
- Phaser should drive the visual game canvas.

## Current recommendation

Use a custom Vite + React + TypeScript + Phaser app, influenced by the Phaser template, with rules separated into plain TypeScript modules. Add Colyseus later as a server-authoritative multiplayer layer.

## Rule

If code is copied directly from a public repo, add attribution to `docs/THIRD_PARTY_NOTICES.md`. If only the structure is used and the actual code is custom, document the repo as inspiration only.
