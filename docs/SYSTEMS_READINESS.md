# Systems Readiness Reference

Updated: 2026-09-09

This file records current implementation readiness. It is not a product, backend, renderer, repository, tool, or workflow lock.

## Current system state

| System | Current state | Current location |
| --- | --- | --- |
| GitHub repository | Active | `dtfgenetics/Thc` |
| Production branch | Active | `main` |
| High Land app | Present | `/apps/high-land-web` |
| High Land multiplayer | Present/live boundary | Hostinger PHP Website Room API |
| Room API source | Present | `/apps/high-land-web/public/api` |
| Browser transport | Present | `websiteRoomTransport.ts` |
| Root High Land build | Available | `npm run build:high-land` |
| Root High Land tests | Available | `npm run test:high-land` |
| Connection preflight | Available | `npm run verify:connections` |
| Agent context | Available | `/AGENTS.md`, `/CLAUDE.md`, `/AI_CONTEXT.md` |
| GitHub Actions | Available | `/.github/workflows/` |

## Current live boundary

Current deployment checks include the public site, game routes, and multiplayer API endpoints. Those checks describe what exists today and may be replaced when the architecture changes.

## Development readiness

The repository is open for full game redesign, code cleanup, backend changes, renderer changes, build-tool changes, route changes, asset replacement, and repository restructuring. Update this document when those changes alter the current system map.

## Validation

Use tests, builds, browser/device checks, multiplayer checks, performance checks, and live-route verification that match the resulting implementation. Existing checks are starting points rather than immutable gates.
