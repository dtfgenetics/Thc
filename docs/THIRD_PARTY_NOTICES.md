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


## howler.js 2.2.4

Repository: https://github.com/goldfire/howler.js

Vendored browser core:
- `apps/high-land-web/public/vendor/howler.core-2.2.4.min.js`

Used by High Land for file-backed music and sound effects, mobile/browser audio compatibility, looping, pooled overlapping effects, mute control, and playback/load error handling.

Copyright (c) 2013-2020 James Simpson and GoldFire Studios, Inc.

Licensed under the MIT License. The upstream copyright and permission notice are preserved in the vendored distribution.


## uPlot 1.6.32

Repository: https://github.com/leeoniya/uPlot

Vendored browser build:
- `site/public-route-patch/assets/vendor/uplot-1.6.32.min.js`
- `site/public-route-patch/assets/vendor/uplot-1.6.32.min.css`

Used by the VPD logger for interactive local time-series visualization, cursor inspection and x-axis zoom while preserving the existing dependency-free canvas fallback.

Copyright (c) 2021 Leon Sorokin

Licensed under the MIT License. The upstream distribution header and this notice preserve attribution for the vendored build.
