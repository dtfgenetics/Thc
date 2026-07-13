# Systems Readiness Checklist

This is the active readiness contract for the website, game hub, multiplayer
room service, deployment, and coding agents.

## Source of truth

| System | Status | Source / setting |
| --- | --- | --- |
| GitHub repository | Ready | `dtfgenetics/Thc` |
| Production branch | Ready | `main` |
| High Land app | Ready for continued development | `/apps/high-land-web` |
| Multiplayer backend | Connected/live boundary | Hostinger PHP Website Room API |
| Room API source | Ready | `/apps/high-land-web/public/api` |
| Browser transport | Ready | `websiteRoomTransport.ts` |
| Backend decision | Locked | `/docs/BACKEND_DECISION.md` |
| Root build script | Ready | `npm run build:high-land` |
| Root test script | Ready | `npm run test:high-land` |
| Connection preflight | Ready | `npm run verify:connections` |
| Agent instructions | Ready | `/AGENTS.md` and `/CLAUDE.md` |
| GitHub Actions CI | Ready | `/.github/workflows/high-land-ci.yml` |

## Verified live boundary

- `https://dtfseeds.com/` responds.
- `https://dtfseeds.com/games/high-land/` responds.
- `/games/high-land/api/` is served by PHP and rejects nonspecific requests.
- `create-room.php` exists and requires POST.
- `get-room.php` exists and requires a room code.
- The live-domain transport factory selects `website` mode.

This is connectivity evidence, not a complete multiplayer pass.

## Still required

1. Add protected Hostinger SSH values to the GitHub `staging` and `production`
   environments.
2. Confirm the exact production and staging remote paths.
3. Run the read-only WordPress audit workflow.
4. Run a complete two-browser/device High Land room test.
5. Verify host authority, join behavior, dice/movement, HIT cards, turn order,
   reconnect, refresh, and winner synchronization.
6. Confirm private room files are not web-readable and expire old rooms.
7. Confirm abuse controls, request-size limits, locking, and cleanup under load.

## Runtime configuration

Production uses the same-origin API automatically. No multiplayer credential or
API URL belongs in the browser environment.

No database password, SSH key, API secret, room storage path, or service token
may be committed or exposed to browser code.

## Connection order

1. GitHub and Drive sources confirmed.
2. Hostinger Website Room API selected and verified.
3. GitHub CI passes.
4. Hostinger staging deployment authorized.
5. Two-device multiplayer acceptance passes on staging.
6. Production deployment is approved with backup and rollback.
7. WordPress audit and carefully staged plugin remediation begin.
8. Discord integration begins only after the website invite flow is stable.

## Readiness definition

Steady development is ready when the repo contains the locked backend decision,
room API, website transport, connection preflight, CI, guarded deployment, and
rollback instructions. Production multiplayer is ready only after the separate
two-device acceptance evidence is recorded.

## Agent handoff prompt

```txt
Work in dtfgenetics/Thc. Read AGENTS.md, CLAUDE.md, README.md,
docs/SYSTEMS_READINESS.md, docs/TOOL_CONNECTIONS.md, and
docs/BACKEND_DECISION.md first. Main is production. The selected multiplayer
backend is the Hostinger PHP Website Room API in
apps/high-land-web/public/api. Do not reconnect Supabase or introduce a second
room authority. Run npm run verify:connections, npm run test:high-land,
npm run build:high-land, and npm run test:e2e:high-land. Do not commit secrets.
Report repository, API-boundary, and two-device live validation separately.
```
