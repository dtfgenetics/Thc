# Systems Readiness Checklist

This file records current readiness signals for the DTFSeeds site, games, multiplayer services, deployment, and development tooling. It is not an implementation lock.

## Current state

| System | Current status |
| --- | --- |
| GitHub integration repository | `dtfgenetics/Thc` |
| Production branch | `main` |
| High Land implementation | currently `apps/high-land-web` |
| High Land multiplayer | currently Hostinger PHP Website Room API |
| CI | GitHub Actions |
| Connection preflight | `npm run verify:connections` |
| Production target | `https://dtfseeds.com` |

These entries describe what exists now. Backends, app locations, routes, build systems, deployment systems, and test tools may be changed when needed.

## Readiness principles

A project is ready for continued development when its current source can be located, changed, built or otherwise exercised, and its key runtime dependencies are understood. A project is production-ready only when the resulting implementation has appropriate automated checks and the exact visitor-facing route has been verified after deployment.

When the architecture changes, replace obsolete readiness checks with checks that validate the new implementation. Do not require retired files, fixed renderers, fixed backends, fixed routes, or fixed testing tools solely because an older version used them.

## Current High Land references

The current High Land implementation may still use:

```txt
apps/high-land-web/
apps/high-land-web/public/api/
npm run test:high-land
npm run build:high-land
```

These are baselines, not requirements for future implementations.

## Multiplayer readiness

When multiplayer is present, verify the authority model, room/session lifecycle, authorization, reconnect behavior, hidden/private state handling, and at least two independent sessions. The specific backend is free to change.

## Responsive and visual readiness

For game releases, verify phone, tablet, laptop, and desktop composition; playable controls; readable game state; valid asset paths; and absence of broken-image fallbacks or obsolete visual layers.

## Production integrity

Credentials and private data must remain protected. Repository validation and live-route validation are separate evidence levels; a commit or build is not proof that production changed.
