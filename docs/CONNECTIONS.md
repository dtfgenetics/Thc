# DTF / THC Connection Reference

Created: 2026-06-21
Updated: 2026-09-09

This file records current connections and implementation locations. It is not an architecture, backend, asset, repository, or workflow lock.

## Current connections

- GitHub account: `dtfgenetics`
- Repository: `dtfgenetics/Thc`
- Default branch: `main`
- High Land app currently: `apps/high-land-web`
- High Land room API currently: `apps/high-land-web/public/api/`
- High Land live API currently: `https://dtfseeds.com/games/high-land/api/`
- Production site: `https://dtfseeds.com`

## Current external surfaces

The project may use GitHub, Hostinger/WordPress, Google Drive, Discord, analytics/search tools, and other connected services as the implementation evolves. Existing service choices are current-state facts rather than mandatory architecture decisions.

## Current High Land multiplayer implementation

The current browser build includes `websiteRoomTransport.ts` and the same-origin PHP room API. This implementation may be modified, replaced, migrated, or consolidated during active development.

## Development

Inspect the current implementation and connected service before changing it, then update this reference when the implementation changes. Use tests, builds, live-route checks, and multi-device verification that are appropriate to the resulting architecture.
