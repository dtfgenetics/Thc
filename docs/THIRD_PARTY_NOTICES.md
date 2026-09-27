# Third-Party Notices

Reference projects reviewed:

- https://github.com/phaserjs/template-vite-ts
- https://github.com/colyseus/tutorial-phaser
- https://github.com/boardgameio/boardgame.io

These are architecture references. This repo should keep attribution here for any outside source that is copied into the project.


## ourcade/sidescrolling-platformer-template-phaser3

Repository: https://github.com/ourcade/sidescrolling-platformer-template-phaser3

The shared finite-state-machine helper in `games/shared-platform/src/state-machine.mjs` is adapted from the project's `src/statemachine/StateMachine.ts`.

Copyright (c) 2019 ourcade

Licensed under the MIT License. The original license permits use, modification, distribution, sublicensing, and sale provided the copyright and permission notice are preserved. DTF's adaptation adds explicit transition payloads, snapshots, queue clearing, optional logging, and a function-based browser/runtime-neutral API.


## Papa Parse 5.7.0

Repository: https://github.com/mholt/PapaParse

Vendored browser build:
- `site/public-route-patch/assets/vendor/papaparse-5.7.0.min.js`

Used by cultivation CSV import workflows for standards-compliant parsing of headers, quoted fields, embedded line breaks, and local files.

Copyright (c) 2015 Matthew Holt

Licensed under the MIT License. The copyright and permission notice from the upstream project are preserved in the vendored distribution.
