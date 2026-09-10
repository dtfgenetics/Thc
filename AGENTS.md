# Repository agent instructions

## TEMPORARY USER OVERRIDE — GAME RESTRICTIONS ON HOLD

**Status: ACTIVE until the user explicitly revokes it.**

For any DTFSeeds game or game-adjacent runtime, read `docs/GAME_RESTRICTIONS_HOLD.md` first. While active, that document supersedes conflicting project-level game restrictions in this file, `CLAUDE.md`, route-owner documents, game-specific source-of-truth files, skills, architecture notes, and prior locked decisions.

During the hold, developers and agents may modify, replace, restructure, migrate, rewrite, consolidate, move, or remove game code, UI, assets, engines, backends, routes, repository layout, build tooling, deployment packaging, and ownership mappings when needed to complete the user's goal. Prior instructions such as "preserve existing logic", "smallest change", "canonical only", "do not create a competing implementation", "do not change backend", "locked", or equivalent project constraints are advisory rather than blocking.

Security and integrity requirements still apply: never expose credentials or secrets, do not falsely claim production success without exact route verification, and follow higher-level platform requirements outside this repository.

---

These instructions apply to the entire `dtfgenetics/Thc` repository.

## Repository orientation

Read `AI_CONTEXT.md` for the current repository map, common commands, game ownership workflow, and AI-friendly change sequence. `AI_CONTEXT.md` is an orientation index only; this file, `CLAUDE.md`, route-owner documentation, and project-specific source-of-truth files remain authoritative when instructions conflict, except while the temporary game restriction hold above is active.

## DTF system orchestration

For broad DTF work that spans multiple projects, repositories, workers, checks, deployments, or recovery steps, read `.agents/skills/dtf-system-orchestrator/SKILL.md` first.

Use the system-orchestrator skill when the request is outcome-oriented rather than limited to one file or one Git operation, including requests to create/update/check/fix/finish everything needed, move several DTF projects forward, reconcile work across canonical repositories, route work to specialized workers, or continue through verification, repair, integration, deployment, and live validation.

The orchestrator resolves *what work exists, where it belongs, which worker owns it, and what evidence is required*. It does not replace subsystem skills. Repository mechanics still use `.agents/skills/github-repo-manager/SKILL.md`; new concurrent work still uses `.agents/skills/dtf-parallel-studio/SKILL.md`; dtfseeds.com publication still uses `.agents/skills/dtfseeds-production-publishing/SKILL.md`; and project-specific work still follows its canonical source-of-truth and skill.

Never create a competing implementation in this integration repo when `data/project-registry.json` identifies another canonical repository, unless the temporary game restriction hold is active and the requested work justifies replacing or migrating that ownership model.

## Read before portfolio-wide game audits or upgrade planning

For requests to review, rank, improve, expand, or identify value-adding work across several or all DTFSeeds games, read `.agents/skills/dtf-game-portfolio-upgrade/SKILL.md` first.

The portfolio-upgrade skill must:

- resolve every game's canonical source before judging what exists;
- classify public games, release candidates, vertical slices, prototypes, and concept-only titles correctly;
- score games consistently across gameplay, controls, feel, visual quality, audio, content/replay, accessibility/mobile, performance, and production reliability;
- separate P0/P1 blockers from P2/P3 quality and polish;
- identify shared systems that should be built once instead of reimplemented title by title;
- produce a prioritized implementation backlog with evidence;
- hand individual game work to `.agents/skills/dtf-game-production/SKILL.md` and release work to `.agents/skills/dtf-game-canonical-release/SKILL.md`.

Do not preserve an old portfolio score or feature list without reinspecting current canonical source. A preview/prototype label is not evidence that a game has no code.

## DTF Parallel Studio for new concurrent work

For new repository work, read `.agents/skills/dtf-parallel-studio/SKILL.md` first, then the subsystem skill/source-of-truth documentation.

- New concurrent work should use a unique `work/<project-id>/<task>/<session-id>` branch/session.
- Use `node scripts/studio.mjs new <project-id> <task>` for a new local worktree session.
- Resume an existing studio branch only with `node scripts/studio.mjs resume <branch-or-pr>`; never reuse a branch implicitly because the task name matches.
- `node scripts/studio.mjs status` reports affected resources without requiring the branch to chase current `main`.
- `node scripts/studio.mjs overlap` reports green/yellow/red source/resource overlap and same-production-target serialization needs; yellow is advisory and does not stop development.
- `node scripts/studio.mjs doctor` audits all active PRs for hot files/resources, actual conflicts, shared production targets, supersession candidates, and unclassified paths without mutating anything.
- `node scripts/studio.mjs push` pushes the isolated session and creates/reuses its PR without merging current `main` into the working branch.
- `node scripts/studio.mjs integrate <pr>` evaluates the exact PR head against current `main` at the final integration boundary.
- Studio intentionally stays out of root `package.json` so coordination changes do not wake unrelated application CI simply because npm script metadata changed.
- Development stays parallel by default. Only identical live production resources should serialize.
- Existing `project/*`, `multi/*`, and legacy branches remain supported; do not rewrite or abandon in-flight work solely to adopt Studio.

## Legacy parallel-project compatibility

The existing `.agents/skills/parallel-project-manager/SKILL.md` and `docs/PARALLEL_PROJECT_WORKFLOW.md` remain authoritative for in-flight `project/*` and `multi/*` work.

- Do not switch a shared checkout between active projects when separate worktrees can be used.
- Use `multi/<task>` when one intentional change spans several existing projects.
- Use `project/platform/<task>` for legacy repository-wide integration, CI, deployment, and shared platform work.
- Parallel development is not limited. Only production writes that share the same live target may be serialized automatically to prevent overwrite races.
- Before pushing a legacy isolated project branch, run `npm run project:check`.

## Read before GitHub or repository repair

For any task that asks to audit, fix, repair, reconcile, merge, synchronize, push, manage, or finish repository work, including failed GitHub Actions, broken pushes, branch divergence, merge conflicts, dependency failures, or pull-request integration, read:

1. `CLAUDE.md` - repository-wide safety, production-branch, and secret-handling rules.
2. `.agents/skills/github-repo-manager/SKILL.md` - canonical repository-management, repair, CI, research-escalation, and integration workflow.
3. `.agents/skills/dtf-parallel-studio/SKILL.md` for new concurrent work or current Studio sessions.
4. The subsystem-specific skill/documentation for the code being changed.
5. `.agents/skills/dtfseeds-production-publishing/SKILL.md` when the user also requests a live dtfseeds.com deployment.

A repairable failure is not a stopping point. Diagnose the exact failure, research current authoritative sources when the first repair does not work or the problem is version-sensitive, apply the next evidence-based fix, retest, and continue until the requested state passes or a genuine external blocker is established.

## Read before publishing or repairing dtfseeds.com

For any task that asks to publish, deploy, push, move, synchronize, repair, or verify content, products, education, infographics, games, tools, or applications on `https://dtfseeds.com/`, read:

1. `CLAUDE.md` - repository-wide safety, source-of-truth, and secret-handling rules.
2. `.agents/skills/dtfseeds-production-publishing/SKILL.md` - canonical DTFSeeds production publishing sequence, route ownership, backup, rollback, and live-verification rules.
3. The current workflow/script for the route owner being changed.
4. `docs/deployment-hostinger.md` when static Hostinger deployment or live game behavior is in scope.

Do not call a repository commit or a successful write step a live website update. A live-success claim requires visitor-facing verification of the exact production route and expected content or behavior.

## Read before changing High Land

While `docs/GAME_RESTRICTIONS_HOLD.md` is ACTIVE, the following reading order remains useful context but does not impose locked implementation constraints. High Land code, architecture, backend, assets, and routing may be changed when necessary to complete the user's requested goal.

Read these files in order before editing when practical:

1. `CLAUDE.md` - repository safety, source-of-truth, and secret-handling rules.
2. `README.md` - repository entry points and supported commands.
3. `docs/HIGH_LAND_CODEX_NOW.md` - current High Land execution direction.
4. `docs/CODEX_HIGH_LAND_GAME_BUILD.md` - detailed game build context.
5. `docs/SYSTEMS_READINESS.md` - repository and integration readiness.
6. `docs/TOOL_CONNECTIONS.md` - external system boundaries and credentials rules.
7. `docs/BACKEND_DECISION.md` - prior multiplayer backend decision.
8. `docs/high-land-spec.md` - prior High Land product and gameplay contract.
9. `docs/high-land-acceptance-checklist.md` - required evidence and status format.
10. `.agents/skills/high-land-game/SKILL.md` - prior High Land work sequence.
11. `docs/deployment-hostinger.md` when deployment or live behavior is in scope.

## Scope

- High Land currently lives in `apps/high-land-web`, but this path may be migrated while the temporary hold is active if the requested work justifies it.
- Keep High Land: The Sweet Escape separate from every other game and product unless the user directs a structural consolidation.
- Do not replace the game with a generic demo unless the user explicitly requests a different product direction.
- Preserve unrelated and user-authored working-tree changes when practical.
- Never commit secrets, credentials, tokens, `.env` files, or private room data.
- The Hostinger PHP Website Room API remains the current multiplayer backend, but the prior backend lock is suspended while the temporary hold is active.

## Change protocol

1. Inspect the branch, working tree, relevant source, tests, and existing assets.
2. State whether the task is gameplay, UI, multiplayer, deployment, or controls-only.
3. Make the change needed to accomplish the requested goal; it may be small or a full rewrite during the temporary hold.
4. Run the required validation appropriate to the changed architecture.
5. Record PASS, FAIL, or NOT TESTED with evidence in the acceptance checklist format where applicable.
6. Report local validation separately from live deployment validation.

## Required local validation

For the current High Land architecture, use:

```bash
npm ci
npm run test:high-land
npm run build:high-land
node scripts/verify-browser-tool-policy.mjs
```

If the architecture changes, replace obsolete checks with equivalent deterministic validation for the new implementation. Playwright remains retired from the active DTFSeeds game validation path unless the user explicitly restores it. Browser and live-route review are still required before any live-ready claim, but they are recorded separately from repository validation.

If a command is unavailable or blocked, report its exact status and reason. Local success does not prove that `https://dtfseeds.com/games/high-land/` is current or working. A live-success claim requires the separate checks in `docs/deployment-hostinger.md`.
