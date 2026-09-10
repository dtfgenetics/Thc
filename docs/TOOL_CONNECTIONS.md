# Tool Connection Map

Updated: 2026-09-09

This document records currently connected systems and useful locations. It does not lock backend choice, repository ownership, build tooling, asset ownership, deployment path, or development sequence.

## Current systems

| System | Current state | Current location |
| --- | --- | --- |
| GitHub repo | Connected | `dtfgenetics/Thc` |
| Production branch | `main` | GitHub |
| High Land app | Present | `apps/high-land-web` |
| High Land multiplayer | Present/live | Hostinger PHP Website Room API |
| CI | Present | `.github/workflows/` |
| Production site | Live | `https://dtfseeds.com` |
| Google Drive | Connected project asset/reference surface | `DTF Project Asset Library - MASTER SOURCE` |
| Discord | May be integrated as needed | project/community tooling |

## Development flexibility

Any current backend, app location, repository mapping, browser framework, renderer, build system, deployment workflow, asset source, or connected tool may be modified or replaced as development requires. When an implementation changes, update the corresponding metadata and deployment configuration to match the new state.

## Current High Land multiplayer implementation

The current implementation uses a same-origin PHP room API and `websiteRoomTransport.ts`. This is a present-state reference, not a backend lock.

## Private automation values

Private credentials belong in the connected service or deployment secret store rather than public browser code or committed source. Current automation may use values such as Hostinger, Discord, OpenAI, or GitHub credentials through the appropriate secret mechanism.

## Verification

Use whatever build, test, browser, device, multiplayer, and live-route verification best matches the implementation being changed. Existing commands are useful starting points and may be updated as the architecture changes.
