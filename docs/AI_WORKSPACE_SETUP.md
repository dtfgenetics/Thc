# AI workspace setup

The repository is prepared for AI-assisted game development without introducing a second package manager or competing source-of-truth system.

## Recommended command

From the repository root:

```bash
npm run ai:setup
```

The command is cross-platform and runs through `scripts/setup-ai-tools.mjs`. It:

1. Requires Node.js 22 or newer.
2. Verifies `package.json`, `package-lock.json`, `AGENTS.md`, `CLAUDE.md`, and `AI_CONTEXT.md` exist.
3. Installs the committed dependency graph with `npm ci`.
4. Prints canonical game ownership and deployment routes with `npm run games:status`.
5. Runs the unified game preflight with `npm run games:preflight`.

## Platform wrappers

Bash:

```bash
bash scripts/setup-ai-tools.sh
```

PowerShell:

```powershell
powershell -ExecutionPolicy Bypass -File scripts/setup-ai-tools.ps1
```

Both wrappers call the same Node implementation so their behavior stays aligned.

## Agent orientation

Read these in order for general game work:

1. `AGENTS.md`
2. `CLAUDE.md`
3. `AI_CONTEXT.md`
4. `docs/GAME_DEVELOPMENT_WORKFLOW.md`
5. `docs/GAME_ARCHITECTURE_STANDARD.md`
6. The game/project source-of-truth document resolved by `npm run games:status -- --id <game-id>`

Publishing and live-route work has additional required reading in `AGENTS.md`.

## CI contract

Game Workspace CI validates the AI setup runner and Bash wrapper whenever the AI context/setup files change, then executes the normal game ownership and preflight checks. This keeps the setup tooling coupled to the same repository contract used for game changes.
