# Tool Connection Map

This document keeps the DTF / THC games workspace aligned across GitHub, Codex, Supabase, Hostinger, WordPress, and future Discord work.

## Source of truth

| System | Status | Connection |
| --- | --- | --- |
| GitHub repo | Connected | `dtfgenetics/Thc` |
| Production branch | Connected | `main` |
| High Land app | Connected in repo | `apps/high-land-web` |
| Supabase local config | Connected in repo | `supabase/config.toml` |
| Supabase MCP | Configured read-only | `.mcp.json` |
| CI | Configured | `.github/workflows/high-land-ci.yml` |
| Deployment target | Manual verification required | Hostinger / WordPress / `dtfseeds.com` |
| Discord | Not connected yet | Add after browser multiplayer works |

## Supabase MCP

The repo includes a project-scoped, read-only MCP config:

```json
{
  "mcpServers": {
    "supabase": {
      "type": "http",
      "url": "https://mcp.supabase.com/mcp?project_ref=cbyisuqpvqlrbuswtdog&read_only=true&features=database,debugging,development,docs"
    }
  }
}
```

Use read-only first. Remove `read_only=true` only after the schema plan is approved and you are ready for Codex to create migrations or database changes.

## Required local environment variables

For the Vite browser app, use public browser-safe values only:

```txt
VITE_SUPABASE_URL=
VITE_SUPABASE_PUBLISHABLE_KEY=
VITE_GAME_SERVER_URL=
```

Do not commit `.env`, `.env.local`, service-role keys, secret keys, database passwords, Hostinger private keys, Discord bot tokens, OpenAI keys, or GitHub tokens.

## GitHub Actions variables and secrets

Use GitHub repository variables for public build values:

```txt
VITE_SUPABASE_URL
VITE_SUPABASE_PUBLISHABLE_KEY
```

Use GitHub repository secrets only for private automation values, when they become necessary:

```txt
SUPABASE_ACCESS_TOKEN
SUPABASE_DB_PASSWORD
SUPABASE_PROJECT_REF
HOSTINGER_SSH_PRIVATE_KEY
HOSTINGER_HOST
HOSTINGER_USER
HOSTINGER_PORT
DISCORD_BOT_TOKEN
OPENAI_API_KEY
```

## Hostinger / WordPress deployment

Manual checks still required in Hostinger:

1. Confirm it deploys from `dtfgenetics/Thc`.
2. Confirm branch is `main`.
3. Confirm build command is `npm run build:high-land`.
4. Confirm publish/output directory is `apps/high-land-web/dist`.
5. Confirm `dtfseeds.com/games/high-land/` points to the built app or WordPress embed path.
6. Confirm frontend env variables are set in Hostinger or the deployment pipeline, not committed.

## Connection order

1. GitHub repo and CI.
2. Supabase MCP read-only.
3. Supabase dashboard GitHub integration.
4. Frontend Supabase public env variables.
5. Multiplayer schema migrations and RLS policies.
6. Hostinger deployment from GitHub.
7. WordPress route/embed.
8. Discord app or bot after the web flow works.

## Codex verification prompt

```txt
Work in `dtfgenetics/Thc`. Read `CLAUDE.md`, `README.md`, `docs/SYSTEMS_READINESS.md`, and `docs/TOOL_CONNECTIONS.md` first. Verify Supabase MCP connects read-only to project `cbyisuqpvqlrbuswtdog`. Do not remove `read_only=true` until the schema plan is approved. Verify the High Land app with `npm run test:high-land` and `npm run build:high-land`. Do not commit secrets. Report what is connected, what still needs manual dashboard setup, and the next safest change.
```
