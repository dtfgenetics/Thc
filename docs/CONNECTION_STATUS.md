# DTF Toolchain Connection Status

Last verified: 2026-07-13

This file records observed connection state. A configured file is not proof that
an external account has authorized access. Re-run `npm run verify:connections`
and check the relevant provider before changing a status.

## Connected and usable

| System | Status | Evidence |
| --- | --- | --- |
| GitHub account | Connected, read/write/admin | `dtfgenetics`; repository access verified through the GitHub app |
| Source repository | Connected | `dtfgenetics/Thc`, production branch `main` |
| Google Drive | Connected, read/write | DTF account profile and master asset library resolved |
| Approved asset root | Connected | `DTF Project Asset Library - MASTER SOURCE` |
| Local Codex checkout | Connected | Git-backed checkout of `dtfgenetics/Thc` |
| Public DTF site | Reachable | `https://dtfseeds.com/` |
| WordPress MCP server | Reachable, authentication required | `/wp-json/mcp/mcp-adapter-default-server` returns an authentication boundary |
| Multiplayer backend | Connected and live | Hostinger PHP Website Room API under `/games/high-land/api/` |
| GitHub CI definitions | Present | `.github/workflows/high-land-ci.yml` and `high-land-web.yml` |

## Prepared but not yet authorized

| System | Status | Required owner action |
| --- | --- | --- |
| Hostinger SSH deployment | Workflow prepared | Add protected GitHub environments and Hostinger SSH secrets/target paths |
| WordPress management tools | Read-only WP-CLI workflow prepared | Add the protected Hostinger SSH connection and WordPress path |
| Full multiplayer acceptance | API connected; end-to-end evidence still required | Run a complete two-device room, turn, reconnect, and winner test |
| Discord application | Not connected | Create app only after browser multiplayer passes |
| Analytics/Search Console | Not verified | Choose one analytics owner and verify domain properties after core flows work |

## GitHub environment contract

Create `staging` and `production` GitHub environments. Require manual approval on
`production`. Store credentials as environment secrets, not repository files.

Required secrets:

- `HOSTINGER_HOST`
- `HOSTINGER_USER`
- `HOSTINGER_PORT` (optional; defaults to 22)
- `HOSTINGER_SSH_PRIVATE_KEY`
- `HOSTINGER_KNOWN_HOSTS`

Required environment variable:

- `HOSTINGER_HIGH_LAND_PATH`
- `HOSTINGER_WORDPRESS_PATH`

Recommended values are separate paths for staging and production. The
production value should resolve to the directory serving
`https://dtfseeds.com/games/high-land/`.

## Operating order

1. Approved art and production references originate in Drive.
2. Code and web-ready asset copies live in GitHub.
3. Pull requests run CI and produce immutable build artifacts.
4. Staging deploys through the protected manual workflow.
5. Live browser and multiplayer checks must pass.
6. Production deployment requires approval and creates a timestamped backup.
7. WordPress content/plugin work remains separate from static game deployment.

The `WordPress Read-only Audit` workflow uses the same protected SSH connection
to inventory core, plugins, themes, database health, and cron without changing
WordPress. Plugin updates remain disabled until a staging backup and restore test
exist.

## Safety rules

- Never paste secrets into issues, pull requests, source files, chat, or build logs.
- Never deploy directly from an untested working tree.
- Never use a passing local build as proof that production changed.
- Never give WordPress, a replacement backend, or Discord write access before the minimum
  required capability is identified and a rollback exists.
