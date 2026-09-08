# DTF Skill and Tool Gap Audit

Status: active implementation backlog

This audit compares the current DTF skill set with the operating needs of the full DTF Genetics / THC portfolio: GitHub convergence, dtfseeds.com, games, education/certification, Plant Atlas, Grow Doc, scientific content, visual assets, deployment, and live QA.

## Existing control layers

The current repository already contains strong foundations for:

- system orchestration;
- GitHub repository management;
- parallel project/worktree coordination;
- content preservation;
- game production and game-portfolio upgrades;
- canonical game release;
- dtfseeds.com production publishing and repair;
- High Land-specific production.

These should remain the owning skills for their existing responsibilities. New skills below should be narrow specialist layers, not competing orchestrators.

## Newly added in this work

### 1. `github-pr-branch-updater` — implemented

Purpose: one guarded operation to merge the latest base branch into an open same-repository PR branch using GitHub's native update-branch endpoint and exact-head SHA protection.

Canonical workflow: `.github/workflows/update-pr-branch.yml`.

### 2. `dtf-web-quality-gate` — implemented

Purpose: common Lighthouse/direct-browser/responsive/accessibility/visual/live-parity quality gate for all visitor-facing pages, games, tools, and educational routes. Playwright is excluded from this workflow.

### 3. `dtf-education-production` — implemented

Purpose: move educational topics through evidence-backed authoring, objectives, assessment, certification mapping, visuals, registry validation, review state, UI, and controlled release.

## Next skills/tools to build

### P0 — `dtf-org-convergence-controller`

Problem: repository-by-repository management is not enough for hundreds of branches and parallel PRs across many DTF repositories.

Required capability:

- organization-wide PR inventory and exact-head status;
- branch ancestry and duplicate-tip analysis;
- supersession graph between PRs/branches;
- unique-work detection before closure/deletion;
- canonical-repository ownership checks;
- safe merge/update/close queue;
- failed/cancelled workflow classification;
- stale branch retirement only after proof of integration;
- machine-readable convergence report.

This should extend the system orchestrator, not replace it.

### P0 — `dtf-live-site-crawler`

Problem: individual route tests miss broken links, images, redirects, stale embeds, console failures, and orphan pages across the complete site.

Required capability:

- discover routes from sitemap/navigation/registries/internal links;
- crawl every reachable production route;
- HTTP/status/redirect validation;
- broken links/images/downloads/assets;
- console/page errors;
- canonical/meta checks;
- screenshot checkpoints;
- route ownership mapping back to repository/project;
- change-detection and issue generation;
- feed failing routes into `dtf-web-quality-gate`.

### P0 — `dtf-atlas-3d-production`

Problem: Plant Atlas combines scientific semantics, 3D assets, GLB structure, semantic meshes/proxies, WebGL runtime, inspector UI, lifecycle state, and mobile interaction. General web/game skills do not fully cover this contract.

Required capability:

- GLB/gltf inspection and normalization;
- named semantic mesh validation;
- semantic hotspot fallback validation;
- mesh-vs-proxy precedence;
- bounds/scale/camera validation;
- raycast/select event testing;
- disposal/context-loss testing;
- responsive/touch inspector flow;
- scientific limitation language;
- model manifest/release validation;
- browser and live acceptance.

### P0 — `dtf-grow-doc-model-ops`

Problem: Grow Doc needs a durable AI/model lifecycle rather than ad hoc model selection or tuning.

Required capability:

- canonical dataset inventory and provenance;
- train/validation/evaluation split policy;
- retrieval vs fine-tuning decision framework;
- open-source model benchmarking;
- domain eval set for cultivation questions;
- hallucination/evidence/uncertainty scoring;
- safety/legal boundary evaluation;
- versioned prompt/model/retrieval configuration;
- offline regression evaluation before promotion;
- production telemetry and rollback criteria.

### P1 — `dtf-scientific-visual-production`

Problem: education requires hundreds of diagrams, infographics, plates, thumbnails, image placements, alt text, and downloadable assets with consistent scientific and visual quality.

Required capability:

- lesson-to-visual brief generation;
- evidence/label checklist;
- image/diagram generation handoff;
- high-resolution derivative pipeline;
- crop/aspect/thumbnail generation;
- alt text and long description;
- rights/provenance record;
- topical asset registry and placement map;
- visual review/freeze state;
- live-page verification.

### P1 — `dtf-game-asset-pipeline`

Problem: browser game code can advance faster than production art/audio/animation assets.

Required capability:

- per-game asset manifest;
- Blender source → optimized GLB/sprite/video derivatives;
- texture/audio compression budgets;
- sprite-sheet normalization;
- animation naming/loop validation;
- audio/voice provenance and loudness normalization;
- placeholder→production replacement tracking;
- WebGL/browser size/performance budgets;
- IP/originality and license records.

This should coordinate Blender/Unity/Unreal/voice tools only where the target game architecture needs them.

### P1 — `dtf-release-evidence-ledger`

Problem: merge/build/deploy/live success are often conflated.

Required capability:

- immutable candidate SHA/version;
- repository checks passed;
- artifact identity/checksum;
- deployment workflow/run/environment;
- production route/version evidence;
- browser/live QA evidence;
- rollback target;
- release status separated into repository, deployment, and visitor-facing completion.

### P1 — `dtf-security-governance`

Problem: many repositories and Actions workflows create recurring secret, permission, dependency, and governance risk.

Required capability:

- ruleset/branch protection inventory;
- token permission analysis;
- workflow permission and event-risk audit;
- secret-pattern detection without redisplaying secrets;
- dependency/security alert triage;
- CODEOWNERS/sensitive path checks;
- OIDC/App/token migration recommendations;
- incident/credential-rotation checklist.

### P1 — `dtf-data-contract-manager`

Problem: games, education, strain/terpene data, Atlas manifests, registries, and public runtime mirrors depend on structured data that can silently drift.

Required capability:

- JSON/schema/version contract registry;
- canonical-vs-generated distinction;
- migration tooling;
- referential integrity across IDs/slugs/routes;
- duplicate/collision detection;
- runtime mirror verification;
- backward compatibility policy;
- release manifest consistency.

### P2 — `dtf-terpene-knowledge-pipeline`

Problem: the planned interactive terpene wheel requires defensible terpene/strain data and uncertainty handling, not just a visual component.

Required capability:

- terpene ontology and aliases;
- strain/sample measurement schema;
- lab/source provenance;
- percentage/range/unknown representation;
- cultivar-vs-sample distinction;
- evidence confidence and date/source metadata;
- interactive wheel data contract;
- education links and accessibility.

### P2 — `dtf-product-observability`

Problem: after release there is no single health view for routes, runtimes, failures, regressions, and stale versions.

Required capability:

- route/runtime health checks;
- version/deployment drift detection;
- recurring browser smoke;
- error/performance trend capture;
- failed-workflow correlation;
- release-age and stale-candidate reporting;
- notification only for actionable change.

## Build order

Recommended implementation order:

1. PR branch updater (done)
2. web quality gate (done)
3. education production (done)
4. organization convergence controller
5. live site crawler
6. Atlas 3D production
7. Grow Doc model ops
8. scientific visual production
9. game asset pipeline
10. release evidence ledger
11. security/governance
12. data contract manager
13. terpene knowledge pipeline
14. product observability

The first seven remove the largest current bottlenecks: branch/PR accumulation, incomplete visitor-facing QA, education pipeline inconsistency, Atlas specialization, and Grow Doc model uncertainty.
