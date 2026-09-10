# DTF / THC Connection Guide

This file records current connection points. It does not lock game architecture, source ownership, backend choice, repository placement, deployment method, or tool order.

## Current observed connections

- GitHub repository: `dtfgenetics/Thc`
- Default production branch: `main`
- Current High Land app location: `apps/high-land-web`
- Current High Land multiplayer implementation: Hostinger PHP Website Room API
- Current live High Land route: `https://dtfseeds.com/games/high-land/`
- Current Drive asset library: `DTF Project Asset Library - MASTER SOURCE`

These are current-state references and may change as the portfolio is redesigned. When implementation moves, update this file to reflect the new reality.

## Working guidance

Use whichever repository, renderer, backend, deployment system, browser tooling, QA tooling, or asset pipeline best serves the current task. Existing Hostinger, Supabase, Firebase, Cloudflare, custom APIs, local transports, and other approaches may be retained, replaced, combined, or removed when technically justified.

For multiplayer, protect authorization, hidden state, private room data, and credentials in whichever architecture is chosen.

For production changes, verify the actual deployed route and expected behavior before calling the change live.

## Current High Land references

```txt
apps/high-land-web/
apps/high-land-web/public/api/
apps/high-land-web/src/game/multiplayer/
```

These paths are not permanent constraints. If High Land is reorganized or rebuilt, update registry/deployment references accordingly.
