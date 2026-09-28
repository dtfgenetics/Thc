# DTF Game Registry v2 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Establish one machine-readable game authority, enforce it with deterministic validation, and require future DTF game work to resolve through it before implementation.

**Architecture:** Introduce `data/game-registry-v2.json` as the canonical identity/location/status contract while retaining the v1 registry during migration. Add focused Node validators and generated-document checks, then install a mandatory `.agents/skills/dtf-game-development/SKILL.md` that reads v2 before any DTF game work. Existing deployment/navigation/project/asset registries remain specialized sources but must reconcile shared fields with v2.

**Tech Stack:** JSON, Node.js ESM, npm scripts, existing DTFSeeds validation/preflight system, repository-local Agent Skills.

**Spec:** `docs/superpowers/specs/2026-09-28-dtf-game-registry-v2-design.md`

## Global Constraints

- `docs/GAME_DEVELOPMENT_FREEDOM.md` remains authoritative: the registry describes current reality and must change when ownership/route/architecture changes.
- Do not force all games into one repository or one runtime.
- Do not represent a game as confirmed live unless exact URL, revision, and verification timestamp support `public-verified`.
- Keep the current `data/game-location-registry.json` and `games:locations:check` during migration.
- Future concepts remain under `concepts[]` until implementation begins.
- Game aliases, production ownership, migration copies, deprecated copies, and release state must be explicit.

## Review Focus

- Burn Buds aliases must resolve to `protect-the-plants`, never the retired Cannabis Fleet Battle source.
- Seed Man and Seed Ascent must remain distinct identities even though both contain "Seed Man".
- Terpocalypse V1 production and V2 experimental source must be distinguishable.
- Standalone games must retain their canonical repo while DTFSeeds owns integration/deployment metadata.
- A game must not reach `public-verified` without exact live verification metadata.

---

### Task 1: Create the v2 Registry and Schema Contract

**Files:**
- Create: `data/game-registry-v2.json`
- Create: `scripts/test-game-registry-v2.mjs`
- Create: `scripts/validate-game-registry-v2.mjs`
- Modify: `package.json`

**Interfaces:**
- Consumes: `data/game-location-registry.json`, current project/source/deployment registries.
- Produces: canonical v2 JSON and `npm run games:registry:check`.

- [ ] **Step 1: Write failing validator tests**
  - Assert duplicate aliases fail.
  - Assert duplicate public routes fail.
  - Assert Burn Buds aliases resolve to `protect-the-plants`.
  - Assert Seed Man and Seed Ascent are distinct.
  - Assert `public-verified` requires URL/revision/timestamp.
  - Assert concepts cannot use implemented/public release states.

- [ ] **Step 2: Run the test and confirm RED**
  - Run: `node scripts/test-game-registry-v2.mjs`
  - Expected: fail because v2 validator/module does not exist.

- [ ] **Step 3: Create `data/game-registry-v2.json`**
  - Migrate every game from v1.
  - Add product goal, genre/players, architecture summary, systems, verification, release, quality, alternate/deprecated locations, and game-contract references.
  - Preserve all existing aliases and compatibility IDs.

- [ ] **Step 4: Implement `scripts/validate-game-registry-v2.mjs`**
  - Export `validateGameRegistry(registry, related?) -> string[]`.
  - CLI exits non-zero with actionable issues.
  - Validate identity/alias/route/product/release/alternate-location requirements.
  - Reconcile public deployment/navigation IDs where existing registries expose matching game records.

- [ ] **Step 5: Run tests and registry check**
  - Run: `node scripts/test-game-registry-v2.mjs`
  - Run: `node scripts/validate-game-registry-v2.mjs`
  - Expected: pass.

- [ ] **Step 6: Add npm script**
  - Add `"games:registry:check": "node scripts/validate-game-registry-v2.mjs"`.

### Task 2: Add Generated Registry Documentation

**Files:**
- Create: `scripts/generate-game-registry-docs.mjs`
- Create: `scripts/test-generate-game-registry-docs.mjs`
- Create: `docs/GAME_REGISTRY_V2.md`
- Modify: `package.json`

**Interfaces:**
- Consumes: validated `data/game-registry-v2.json`.
- Produces: deterministic human-readable portfolio/source/status document and check mode.

- [ ] **Step 1: Write failing generator tests**
  - Stable sort by title.
  - Includes canonical repo, route, release state, integration owner, next milestone.
  - Distinguishes development/deprecated copies.
  - Check mode fails on stale content.

- [ ] **Step 2: Verify RED**
  - Run: `node scripts/test-generate-game-registry-docs.mjs`
  - Expected: fail because generator does not exist.

- [ ] **Step 3: Implement generator**
  - Support `--check`.
  - Generate `docs/GAME_REGISTRY_V2.md` with an explicit generated marker.

- [ ] **Step 4: Add npm scripts**
  - `games:registry:docs`
  - `games:registry:docs:check`

- [ ] **Step 5: Verify generator**
  - Run generator.
  - Run check mode.
  - Run generator tests.

### Task 3: Install Mandatory DTF Game Development Skill

**Files:**
- Create: `.agents/skills/dtf-game-development/SKILL.md`
- Create: `scripts/test-dtf-game-development-skill.mjs`
- Modify: `.agents/skills/dtf-game-location-resolver/SKILL.md`

**Interfaces:**
- Consumes: `data/game-registry-v2.json`, game contract/source-of-truth docs.
- Produces: mandatory preflight behavior for future DTF game tasks.

- [ ] **Step 1: Record baseline failure scenarios**
  - Burn Buds vs migration/archive copies.
  - Seed Man vs Seed Ascent.
  - Terpocalypse stable vs experimental.
  - Kush Kings source vs DTFSeeds integration.
  - deployed output vs canonical source.
  - Because this runtime has no fresh-context subagent runner, preserve these as deterministic skill-contract scenarios and explicitly note that behavioral pressure testing remains a follow-up gate when such a runner is available.

- [ ] **Step 2: Write failing structural skill-contract test**
  - Assert mandatory-first-read, alias resolution, canonical owner, source-of-truth read, alternate-copy inspection, release/live verification, architecture-change registry update, and Game Studio routing requirements.

- [ ] **Step 3: Verify RED**
  - Run: `node scripts/test-dtf-game-development-skill.mjs`
  - Expected: fail because skill is absent.

- [ ] **Step 4: Create skill**
  - Concise, searchable, third-person `Use when...` description.
  - Positive preflight recipe.
  - Explicit known ambiguity table.
  - Mandatory game-registry resolution before implementation.

- [ ] **Step 5: Convert location resolver to compatibility wrapper**
  - Point to v2 + `dtf-game-development`.
  - Remove duplicated independent policy.

- [ ] **Step 6: Run skill-contract test**
  - Expected: pass.

### Task 4: Wire Registry into Preflight and Project OS

**Files:**
- Modify: `package.json`
- Create: `scripts/test-game-registry-preflight.mjs`

**Interfaces:**
- Consumes: Task 1 and Task 2 commands.
- Produces: release-blocking registry and doc drift gates.

- [ ] **Step 1: Write failing preflight contract test**
  - Assert `games:preflight` includes `games:registry:check` and `games:registry:docs:check`.
  - Assert `verify:project-os` includes v2 registry validation.

- [ ] **Step 2: Verify RED**
  - Run contract test and confirm it fails.

- [ ] **Step 3: Update package scripts**
  - Add v2 checks without removing current v1/location checks.

- [ ] **Step 4: Verify GREEN**
  - Run contract test.
  - Run v2 validator and docs check.

### Task 5: Reconcile Known Registry Drift

**Files:**
- Modify: `data/game-registry-v2.json`
- Modify generated doc via generator
- Potentially modify related registries only where a concrete conflict is proven

**Interfaces:**
- Consumes: validator findings.
- Produces: consistent ownership/status for all currently tracked identities.

- [ ] **Step 1: Run reconciliation checks and capture concrete mismatches**
- [ ] **Step 2: Fix only proven conflicts**
  - Ganjumanji pinned revision/status.
  - THC RPG pinned revision/status.
  - Burn Buds identity.
  - Seed Ascent and Stoner Duck Race owner/status.
  - Root Cause non-public status.
  - standalone repo ownership.
- [ ] **Step 3: Regenerate docs**
- [ ] **Step 4: Run registry, docs, existing location, navigation, scope, and release-integrity validators**

### Task 6: Final Verification

**Files:** none unless verification exposes defects.

- [ ] **Step 1: Run focused suite**
  - `node scripts/test-game-registry-v2.mjs`
  - `node scripts/test-generate-game-registry-docs.mjs`
  - `node scripts/test-dtf-game-development-skill.mjs`
  - `node scripts/test-game-registry-preflight.mjs`

- [ ] **Step 2: Run migration gates**
  - `npm run games:registry:check`
  - `npm run games:registry:docs:check`
  - `npm run games:locations:check`
  - `npm run verify:navigation`
  - `npm run verify:game-scope`
  - `npm run verify:release-integrity`

- [ ] **Step 3: Run the broader game preflight if connector/runtime execution is available**
  - `npm run games:preflight`
  - Report any unrelated existing failures by name rather than suppressing them.

- [ ] **Step 4: Verify generated docs and skill contain no placeholders**
- [ ] **Step 5: Review exact changed files and commit results**
