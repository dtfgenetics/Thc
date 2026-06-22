# Systems Readiness Checklist

This document is the operating checklist for keeping the website, game hub, Supabase project, and coding agents aligned.

## Source of truth

| System | Status | Source / setting |
| --- | --- | --- |
| GitHub repository | Ready | `dtfgenetics/Thc` |
| Production branch | Ready | `main` |
| Supabase folder | Ready | `/supabase` |
| Supabase local config | Ready | `/supabase/config.toml` |
| Supabase MCP config | Ready, read-only | `/.mcp.json` |
| Supabase GitHub working directory | Ready | `.` |
| High Land app | Ready for continued development | `/apps/high-land-web` |
| Root build script | Ready | `npm run build:high-land` |
| Root test script | Ready | `npm run test:high-land` |
| Agent instruction file | Ready | `/CLAUDE.md` |
| Tool connection map | Ready | `/docs/TOOL_CONNECTIONS.md` |

## Still needs manual connection or confirmation

These cannot be fully verified from the repository alone:

1. Supabase dashboard GitHub integration is connected to `dtfgenetics/Thc`.
2. Supabase production branch is set to `main`.
3. Supabase working directory is set to `.`.
4. Supabase MCP has been authenticated in Codex through browser OAuth.
5. Hostinger deployment is connected to the same GitHub repository and production branch.
6. Hostinger build command is set to `npm run build:high-land`.
7. Hostinger publish/output directory is set to `apps/high-land-web/dist` unless Hostinger wraps the build differently.
8. Claude Code Web / Codex is connected to the same GitHub repository.
9. Any required environment variables are set in the deployment dashboard, not committed to GitHub.

## Required environment variables

Frontend variables may be public browser values only:

```txt
VITE_SUPABASE_URL
VITE_SUPABASE_PUBLISHABLE_KEY
```

Legacy `anon` keys may still work, but new work should prefer Supabase publishable keys.

Never commit these private values:

```txt
SUPABASE_SERVICE_ROLE_KEY
SUPABASE_SECRET_KEY
SUPABASE_DB_PASSWORD
SUPABASE_ACCESS_TOKEN
DISCORD_BOT_TOKEN
HOSTINGER_API_KEY
HOSTINGER_SSH_PRIVATE_KEY
OPENAI_API_KEY
ANTHROPIC_API_KEY
GITHUB_TOKEN
```

## Recommended connection order

1. GitHub repo confirmed.
2. Supabase MCP connected in read-only, project-scoped mode.
3. Supabase GitHub integration connected.
4. Hostinger deployment connected to GitHub `main`.
5. Codex / Claude Code Web connected to GitHub.
6. GitHub Actions CI confirms the app builds and tests.
7. Supabase migrations added for multiplayer/session tables.
8. Website receives Supabase env variables in the deployment dashboard.
9. Discord app/bot added only after browser sessions work.

## Readiness definition

The project is considered ready for steady development when:

- `main` contains `/supabase/config.toml`.
- `main` contains `/.mcp.json` in read-only, project-scoped mode.
- `main` contains `/CLAUDE.md`.
- `main` contains `/docs/TOOL_CONNECTIONS.md`.
- `main` contains a GitHub Actions CI workflow.
- Supabase dashboard is connected to GitHub with working directory `.` and branch `main`.
- Supabase MCP authentication has been completed in Codex.
- Hostinger is connected to GitHub and can deploy `apps/high-land-web/dist`.
- Build and test commands complete successfully.

## Agent handoff prompt

Use this with Codex, Claude Code, or another coding agent:

```txt
Work in the dtfgenetics/Thc repository. Read CLAUDE.md, README.md, docs/SYSTEMS_READINESS.md, and docs/TOOL_CONNECTIONS.md first. Main is production. Supabase lives in /supabase and High Land lives in /apps/high-land-web. Supabase MCP is configured read-only in .mcp.json; authenticate it through browser OAuth before using it. Do not remove read_only=true or make production database changes until the schema plan is approved. Do not replace the current game with a generic demo. Make small changes, add tests when changing rules or session behavior, and run npm run test:high-land plus npm run build:high-land before reporting success.
```
