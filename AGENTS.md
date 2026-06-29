# Repository agent instructions

These instructions apply to the entire `dtfgenetics/Thc` repository.

## Read before changing High Land

Read these files in order before editing:

1. `CLAUDE.md` - repository safety, source-of-truth, and secret-handling rules.
2. `README.md` - repository entry points and supported commands.
3. `docs/HIGH_LAND_CODEX_NOW.md` - current High Land execution direction.
4. `docs/CODEX_HIGH_LAND_GAME_BUILD.md` - detailed game build context.
5. `docs/SYSTEMS_READINESS.md` - repository and integration readiness.
6. `docs/TOOL_CONNECTIONS.md` - external system boundaries and credentials rules.
7. `docs/high-land-spec.md` - locked High Land product and gameplay contract.
8. `docs/high-land-acceptance-checklist.md` - required evidence and status format.
9. `.agents/skills/high-land-game/SKILL.md` - exact High Land work sequence.
10. `docs/deployment-hostinger.md` when deployment or live behavior is in scope.

Keep `CLAUDE.md`. Its repository-wide safety rules remain authoritative. When an
older gameplay note conflicts with `docs/high-land-spec.md` or
`docs/HIGH_LAND_CODEX_NOW.md`, follow the newer High Land contract and report the
conflict rather than silently changing the product.

## Scope

- High Land lives in `apps/high-land-web`.
- Keep High Land: The Sweet Escape separate from every other game and product.
- Do not replace the game with a generic demo or unrelated content.
- Do not edit gameplay while performing a documentation, workflow, or repository-control task.
- Preserve unrelated and user-authored working-tree changes.
- Never commit secrets, credentials, tokens, `.env` files, or private room data.

## Change protocol

1. Inspect the branch, working tree, relevant source, tests, and existing assets.
2. State whether the task is gameplay, UI, multiplayer, deployment, or controls-only.
3. Make the smallest in-scope change and add tests for changed behavior.
4. Run the required validation from the repository root.
5. Record PASS, FAIL, or NOT TESTED with evidence in the acceptance checklist format.
6. Report local validation separately from live deployment validation.

## Required local validation

```bash
npm ci
npm run test:high-land
npm run build:high-land
npm run test:e2e:high-land
```

If a command is unavailable or blocked, report its exact status and reason. Local
success does not prove that `https://dtfseeds.com/games/high-land/` is current or
working. A live-success claim requires the separate checks in
`docs/deployment-hostinger.md`.
