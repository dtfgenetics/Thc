# THC Tools Repository Split Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make `dtfgenetics/thc-tools` the canonical code repository for the complete THC cultivation-tool suite while preserving every existing `dtfseeds.com` tool URL and keeping `dtfgenetics/Thc` as a rollback source until parity is proven.

**Architecture:** Build one canonical tool registry in the current source repo first, use it to drive inventory and validation, then copy the tool product into the new repository without changing public slugs. Deployment integration remains in `dtfgenetics/Thc` until the new repository can produce an equivalent public-suite payload; duplicate source is removed only after local and live parity gates pass.

**Tech Stack:** Node.js ESM, static HTML/CSS/JS tool routes, JSON registries, existing THC cultivation math/runtime assets, current public-suite deployment scripts, GitHub Actions where applicable.

**Spec:** `docs/superpowers/specs/2026-09-27-thc-tools-repository-split-design.md`

## Global Constraints

- Public tool URLs on `https://dtfseeds.com` must not change.
- No destructive deletion from `dtfgenetics/Thc` before the new repository passes equivalent local and live verification.
- Academy, encyclopedia, certification curriculum, games, and unrelated site code remain outside the new repository.
- Existing cultivation calculations and GrowLens bridge behavior must be preserved.
- The canonical registry must drive both static validation and live verification so route coverage cannot drift.
- No production page may depend on a file that exists only in `dtfgenetics/Thc` after cutover.
- Live deployment verification is separate from repository build verification.
- The target repository must exist before Task 3 can begin.

## Review Focus

1. A registered tool whose route exists but whose shared asset is missing must fail validation before deployment.
2. A tool added to the registry must automatically appear in both local route validation and live verification coverage.
3. A tool route that still references a THC-repo-only asset after migration must fail the cross-repository dependency gate.
4. GrowLens-integrated tools must retain their expected bridge action/token after migration.
5. Public routes must remain identical before and after repository ownership changes.

---

### Task 1: Build the migration inventory and canonical registry in `dtfgenetics/Thc`

**Files:**
- Create: `data/tool-registry.json`
- Create: `scripts/build-tool-migration-inventory.mjs`
- Create: `docs/THC_TOOLS_MIGRATION_INVENTORY.md`
- Test: `scripts/test-tool-registry.mjs`
- Read/consume: `site/deployment/public-apps.json`
- Read/consume: `data/public-navigation.json`
- Read/consume: `site/public-route-patch/*`
- Read/consume: `scripts/validate-thc-tool-suite-v1.mjs`
- Read/consume: `scripts/verify-cultivation-reference-tools-live.mjs`

**Interfaces:**
- Consumes: current route folders, current navigation/deployment manifests, current validators.
- Produces: `data/tool-registry.json` with fields `id`, `slug`, `title`, `category`, `public`, `sourcePath`, `requiredAssets`, `validationMarkers`, `liveMarkers`, `growlensBridge`.

- [ ] **Step 1: Write the failing registry test**

Create `scripts/test-tool-registry.mjs` asserting:
- all 23 spec-owned slugs are present exactly once;
- every `sourcePath` exists;
- every public tool has at least one validation marker and live marker;
- every required shared asset exists;
- `ipm-scout`, `grow-planner`, and `breeder-pedigree` are explicitly present.

- [ ] **Step 2: Run the registry test and verify it fails**

Run: `node scripts/test-tool-registry.mjs`

Expected: FAIL because `data/tool-registry.json` does not yet exist.

- [ ] **Step 3: Create `data/tool-registry.json`**

Populate it from the approved repository boundary and the actual source files. Keep public slugs identical to production.

- [ ] **Step 4: Create `scripts/build-tool-migration-inventory.mjs`**

The script must read the registry plus current public-app/navigation manifests and emit a deterministic Markdown inventory containing each route's source folder, shared assets, deployment registration, navigation registration, GrowLens bridge status, and validator coverage.

- [ ] **Step 5: Generate the inventory**

Run: `node scripts/build-tool-migration-inventory.mjs > docs/THC_TOOLS_MIGRATION_INVENTORY.md`

Expected: Markdown inventory with all registered tools and no unresolved source paths.

- [ ] **Step 6: Run the registry test**

Run: `node scripts/test-tool-registry.mjs`

Expected: PASS for all registered tool routes and shared assets.

- [ ] **Step 7: Commit**

Commit message: `chore: inventory THC tool repository boundary`

---

### Task 2: Replace split validator route lists with registry-driven coverage

**Files:**
- Create: `scripts/validate-tool-registry-routes.mjs`
- Create: `scripts/verify-tool-registry-live.mjs`
- Modify: `package.json`
- Modify: `scripts/validate-thc-tool-suite-v1.mjs`
- Modify: `scripts/verify-cultivation-reference-tools-live.mjs`
- Test: `scripts/test-tool-registry-validation.mjs`

**Interfaces:**
- Consumes: `data/tool-registry.json` from Task 1.
- Produces: one route iteration contract used by both local and live verification.

- [ ] **Step 1: Write a failing drift test**

Create `scripts/test-tool-registry-validation.mjs` that asserts:
- local validator coverage equals all public registry entries;
- live verifier coverage equals all public registry entries;
- adding a fixture tool to an in-memory registry causes both validators to include it without editing hard-coded route arrays.

- [ ] **Step 2: Run the drift test**

Run: `node scripts/test-tool-registry-validation.mjs`

Expected: FAIL because current validators maintain independent hard-coded arrays.

- [ ] **Step 3: Implement registry-driven local validation**

Create `scripts/validate-tool-registry-routes.mjs` and refactor `validate-thc-tool-suite-v1.mjs` to consume the registry rather than owning the route list.

- [ ] **Step 4: Implement registry-driven live verification**

Create `scripts/verify-tool-registry-live.mjs` and refactor `verify-cultivation-reference-tools-live.mjs` to consume the same registry.

- [ ] **Step 5: Wire package scripts**

Add:
- `verify:tool-registry`
- `verify:tool-registry:live`

Keep existing compatibility script names working.

- [ ] **Step 6: Run validation**

Run:
`node scripts/test-tool-registry-validation.mjs && npm run verify:tool-registry`

Expected: PASS and explicit coverage of every public registry route.

- [ ] **Step 7: Commit**

Commit message: `test: drive THC tool verification from registry`

---

### Task 3: Bootstrap `dtfgenetics/thc-tools`

**Precondition:** the repository `dtfgenetics/thc-tools` exists and is writable.

**Files in new repo:**
- Create: `README.md`
- Create: `AGENTS.md`
- Create: `package.json`
- Create: `data/tool-registry.json`
- Create: `scripts/validate-tools.mjs`
- Create: `scripts/verify-live.mjs`
- Create: `tests/registry.test.mjs`

**Interfaces:**
- Consumes: canonical registry and migration inventory from Tasks 1-2.
- Produces: independently testable repository shell with no production cutover yet.

- [ ] **Step 1: Write the failing new-repo registry test**

The test must require the complete canonical registry and reject missing/duplicate slugs.

- [ ] **Step 2: Run the test**

Run: `npm test`

Expected: FAIL until repository metadata and registry are present.

- [ ] **Step 3: Add repository metadata and registry**

Use the same public route identifiers and source ownership defined in Task 1.

- [ ] **Step 4: Add validation entry points**

Implement deterministic local registry validation and live verification runners.

- [ ] **Step 5: Run the test suite**

Run: `npm test`

Expected: PASS.

- [ ] **Step 6: Commit**

Commit message: `chore: bootstrap THC tools repository`

---

### Task 4: Migrate shared runtime and calculation assets

**Files in new repo:**
- Create/copy: `packages/cultivation-math/`
- Create/copy: `packages/cultivation-context/`
- Create/copy: `packages/measurement-journal/`
- Create/copy: `packages/shared-ui/`
- Create/copy: `packages/charts/`
- Create/copy: `public/vendor/`
- Test: `tests/shared-runtime.test.mjs`
- Test: `tests/cultivation-math.test.mjs`

**Interfaces:**
- Consumes: current THC shared assets and fixture expectations.
- Produces: all shared runtime needed by migrated tool pages without reaching back into `dtfgenetics/Thc`.

- [ ] **Step 1: Write failing runtime-presence tests**

Assert all registry-declared shared assets resolve inside the new repo.

- [ ] **Step 2: Write failing calculation fixture tests**

Cover existing fixtures for DLI, VPD, dew point, dilution, EC/ppm conversion, dryback, ventilation, fertilizer mass, and unit conversions.

- [ ] **Step 3: Run tests**

Run: `npm test`

Expected: FAIL until runtime assets are migrated.

- [ ] **Step 4: Copy and normalize shared runtime**

Preserve behavior first; reorganize paths only where the new repo owns the import contract.

- [ ] **Step 5: Run tests**

Run: `npm test`

Expected: PASS with no imports from `dtfgenetics/Thc`.

- [ ] **Step 6: Commit**

Commit message: `feat: migrate THC shared tool runtime`

---

### Task 5: Migrate all tool route implementations

**Files in new repo:**
- Create/copy: one route directory for every registry entry.
- Test: `tests/routes.test.mjs`
- Test: `tests/growlens-bridges.test.mjs`

**Interfaces:**
- Consumes: registry and shared runtime from Tasks 3-4.
- Produces: complete static route payload for every public tool URL.

- [ ] **Step 1: Write failing route tests**

For each registry entry assert:
- route entry file exists;
- title marker exists;
- return link to `/tools/` exists where applicable;
- declared shared assets resolve;
- no route imports a source path that exists only in `dtfgenetics/Thc`.

- [ ] **Step 2: Write failing GrowLens bridge tests**

For registry entries with `growlensBridge=true`, assert the route contains its expected bridge action/token.

- [ ] **Step 3: Run tests**

Run: `npm test`

Expected: FAIL until route implementations are migrated.

- [ ] **Step 4: Copy route implementations**

Migrate every route in the registry. Preserve public paths and current behavior.

- [ ] **Step 5: Normalize route asset references**

Point routes only at assets supplied by `thc-tools`.

- [ ] **Step 6: Run tests**

Run: `npm test`

Expected: PASS for route completeness and GrowLens bridges.

- [ ] **Step 7: Commit**

Commit message: `feat: migrate THC cultivation tool routes`

---

### Task 6: Produce the public-suite deployment artifact from `thc-tools`

**Files in new repo:**
- Create: `scripts/build.mjs`
- Create: `dist/` via build output only
- Test: `tests/build-output.test.mjs`

**Interfaces:**
- Consumes: all routes and shared assets in the new repo.
- Produces: deterministic directory payload matching the existing public slugs expected by the DTFSeeds deployment pipeline.

- [ ] **Step 1: Write the failing build-output test**

Assert every public registry slug and every required shared asset appears in build output.

- [ ] **Step 2: Run test**

Run: `npm test`

Expected: FAIL because no build output exists.

- [ ] **Step 3: Implement build script**

The build script copies/assembles route payloads into a deterministic deployment directory without changing slugs.

- [ ] **Step 4: Run build and tests**

Run: `npm run build && npm test`

Expected: PASS and output contains every registry-owned route.

- [ ] **Step 5: Commit**

Commit message: `build: package THC tools public suite`

---

### Task 7: Integrate new-repo artifacts into `dtfgenetics/Thc` deployment

**Files in `dtfgenetics/Thc`:**
- Modify: current public-suite packaging/deployment scripts identified by the Task 1 inventory.
- Modify: `site/deployment/public-apps.json` only if ownership metadata requires it.
- Modify: `docs/PROJECT_SOURCE_OF_TRUTH.md`
- Test: add an integration test adjacent to the deployment adapter.

**Interfaces:**
- Consumes: deterministic `thc-tools` build artifact from Task 6.
- Produces: the same deployed `dtfseeds.com` route tree currently produced from local THC-repo route folders.

- [ ] **Step 1: Write a failing deployment parity test**

Compare expected tool route paths/assets from the registry against the deployment payload assembled by `Thc`.

- [ ] **Step 2: Run the test**

Expected: FAIL because deployment still sources tool implementation from local THC folders.

- [ ] **Step 3: Add explicit external artifact ingestion**

Make the existing deployment pipeline consume the new repository artifact while preserving existing slugs.

- [ ] **Step 4: Update source-of-truth documentation**

Mark `dtfgenetics/thc-tools` as canonical code authority for the tool suite while `Thc` remains deployment/integration authority where applicable.

- [ ] **Step 5: Run local parity verification**

Run the relevant public-suite qualification and tool registry validation commands.

Expected: PASS with identical route paths.

- [ ] **Step 6: Commit**

Commit message: `build: source cultivation tools from thc-tools`

---

### Task 8: Verify live parity before deleting duplicate source

**Files:**
- No production source deletion yet.
- Update release documentation only after checks pass.

**Interfaces:**
- Consumes: deployed artifact path from Task 7.
- Produces: evidence that the repository split is safe to cut over.

- [ ] **Step 1: Run full new-repo test/build suite**

Run: `npm test && npm run build` in `thc-tools`.

Expected: PASS.

- [ ] **Step 2: Run THC integration suite**

Run the registry/local public-suite qualification commands in `Thc`.

Expected: PASS.

- [ ] **Step 3: Run live registry verification**

Run the new registry-driven live verifier against `https://dtfseeds.com`.

Expected: every public route and required shared asset returns HTTP 200 and required markers.

- [ ] **Step 4: Record parity evidence**

Document the commit SHAs from both repos and the verification results.

- [ ] **Step 5: Commit release evidence**

Commit message: `docs: record THC tools repository parity verification`

---

### Task 9: Remove duplicate implementation ownership from `dtfgenetics/Thc`

**Precondition:** Task 8 local and live parity gates are green.

**Files in `dtfgenetics/Thc`:**
- Remove: migrated tool implementation folders and duplicated shared runtime identified by the inventory.
- Keep: deployment adapter, navigation/integration references, and deliberate cross-product interfaces.
- Modify: validators to fail if duplicate canonical tool source reappears.
- Test: `scripts/test-thc-tools-ownership-boundary.mjs`

**Interfaces:**
- Consumes: verified `thc-tools` deployment contract.
- Produces: one canonical tool code owner with no ambiguous duplicate source.

- [ ] **Step 1: Write the failing ownership-boundary test**

Assert migrated route implementation directories and canonical shared tool runtime are no longer owned locally after cutover, while deployment integration references remain.

- [ ] **Step 2: Run the test**

Expected: FAIL while duplicate source still exists.

- [ ] **Step 3: Remove only verified duplicate implementation files**

Use Task 1 inventory as the deletion allowlist.

- [ ] **Step 4: Run local integration and ownership tests**

Expected: PASS.

- [ ] **Step 5: Run final live verification**

Expected: all public tool routes remain unchanged and green.

- [ ] **Step 6: Commit**

Commit message: `refactor: complete THC tools repository ownership cutover`
