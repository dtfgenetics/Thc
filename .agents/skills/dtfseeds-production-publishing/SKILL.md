# DTFSeeds Production Publishing Skill

Use this skill for any task that asks to publish, deploy, push, move, synchronize, repair, or verify content or applications on `https://dtfseeds.com/`.

The goal is to reuse the production paths that are already proven in this repository and to avoid confusing a repository commit with a live website update.

## Non-negotiable rule

A commit, successful local build, or successful write step is **not** a live deployment claim.

Only say that something is live, fixed, pushed, or completed after a visitor-facing production check against `https://dtfseeds.com/` passes for the exact route and expected content/behavior.

Always report these separately when relevant:

1. Source/repository state.
2. Production write/deployment state.
3. Visitor-facing verification state.

If step 3 has not passed, the correct status is `NOT VERIFIED LIVE` even if the repository and production write steps succeeded.

## MAKE IT LIVE execution contract

When the user says **make it live**, **push it live**, **put this on the site**, **publish this**, **deploy this**, or equivalent language, treat that as authorization to execute the complete applicable production chain in the current task.

Do **not** stop at any of these intermediate states unless an external hard blocker makes further execution impossible:

- local/generated artifact created,
- deployment package or ZIP created,
- temporary transfer/staging copy created,
- feature or transfer branch created,
- Git blob created,
- canonical source committed,
- `main` updated,
- workflow merely triggered,
- production write merely started,
- WordPress record/media merely created,
- crawler/search snippet checked without origin verification.

For a normal in-scope production request, continue through:

**canonical source → `main` → production workflow → production write → visitor-facing verification**.

If a step fails, inspect and repair the failure, then continue. Do not turn a repairable failure into a planning discussion or ask the user to perform routine repo/deployment steps that the connected production path can perform.

Only stop short of live completion when there is a genuine blocker such as unavailable credentials/connector permissions, a protected environment requiring an external approval that cannot be performed here, an unsafe/destructive ambiguity, or a third-party outage. In that case, report the exact blocker and the last successfully completed stage. Do not represent the work as live.

### Binary/image asset rule

When the requested live change includes images, videos, archives, or other binary assets:

1. Verify the source file exists and inspect its dimensions/format when relevant.
2. Use the route owner's canonical repository asset directory. For THC infographics this is `site/wordpress/assets/infographics/` and the publication policy keeps canonical infographic source files flat.
3. Prefer a directly supported production image format (`.png`, `.jpg`, `.jpeg`, `.webp`, `.gif`) so the existing staging/publisher can validate its signature.
4. When a normal text contents write is unsuitable for the binary, use Git data primitives such as blob → tree → commit → ref update. Re-read the current `main` head immediately before creating the final commit so concurrent work is not discarded.
5. Never force-update `main` merely to simplify a binary transfer. Preserve unrelated/newer work.
6. Verify each binary landed at the intended repository path and is not a thumbnail, corrupt image, mislabeled extension, or temporary transport file.
7. Let the canonical quality/staging publisher handle eligible assets. Do not bypass its exclusion/quarantine rules just to make an image appear.
8. Verify the production media and actual visitor-visible image on the intended page/library route before reporting the image live.

For THC education/infographic publication, inspect the current versions of:

- `site/wordpress/assets/infographics/placement-rules.json`
- `scripts/stage-eligible-infographics.mjs`
- `scripts/deploy-wordpress-infographic-library-rest.mjs`
- `scripts/publish-wordpress-topic-literature.mjs`
- `.github/workflows/wordpress-infographic-production.yml`

Do not assume an old filename classifier, asset count, or workflow behavior is still current; read the files at `main` first.

### Workflow-follow-through rule

After pushing the production-triggering commit:

1. Find the workflow run associated with the new `main` state.
2. Follow its jobs/steps until they settle.
3. If concurrency cancels a run, identify the superseding run and follow that one instead of treating the cancellation as the content failure.
4. If validation, upload, WordPress write, or visitor verification fails, read the relevant job steps/logs and repair the specific failure.
5. Do not claim success from an earlier successful run that does not contain the new commit/content.

### Visitor verification rule

A live-success claim requires an origin/public check for the exact requested work. Use a cache-busting query parameter when appropriate.

For a new infographic/image release, verify both:

- the intended topic route (for example `/learn/outdoor/`), and
- the infographic library (`/learn/infographics/`) when that library is part of the publishing lane.

Verify a positive fingerprint of the new release, such as the expected image/media URL, title, unique marker, card, or rendered asset. When the task replaces bad content, also verify the stale/incorrect fingerprint is gone where practical.

An external search crawler may remain stale after the origin is correct. Record that separately; do not substitute crawler freshness for origin verification.

## Production map

DTFSeeds uses more than one publishing lane. Choose the owner of the route before changing anything.

### WordPress editorial pages

Canonical source:

- `site/wordpress/pages/`

Production scripts:

- `scripts/apply-wordpress-public-content-rest.mjs`
- `scripts/reconcile-wordpress-presentation-rest.mjs`

Protected production workflow:

- `.github/workflows/wordpress-presentation-repair-production.yml`

WordPress owns the canonical editorial/root pages such as Home, Seeds, Learn, Community, Shop, Gallery, About, and Contact. Do not make static game routes WordPress-owned merely to make a publisher pass.

The WordPress REST lane uses the protected `production` environment with `WP_API_USERNAME` and `WP_API_PASSWORD`. Never print, copy, or commit credential values.

### THC education and infographics

Published education and infographic content must use the repository-controlled source and the existing production publisher/reconciliation workflows.

Canonical infographic source:

- `site/wordpress/assets/infographics/`

Current production workflow:

- `.github/workflows/wordpress-infographic-production.yml`

The infographic library is visitor-facing at:

- `https://dtfseeds.com/learn/infographics/`

Do not hardcode the current asset count into future acceptance checks. Read the current manifest/status and verify the actual source count, WordPress media state, and live rendered page.

Keep draft, quarantined, superseded, review-required, or unresolved QA artwork out of the public library until its release status permits publication.

For education pages, verify the exact public child routes and the Learn navigation after publication. A WordPress record existing is not enough; the visitor route must render the expected current content.

### WooCommerce genetics/products

Canonical product data and reconciliation files live under:

- `site/wordpress/products/`

Use the semantic WooCommerce reconciliation path, including:

- `scripts/reconcile-woocommerce-products-semantic.mjs`
- `scripts/rollback-woocommerce-products.mjs`
- `.github/workflows/woocommerce-product-reconcile-production.yml`

Use pinned product identities when the reconciliation package specifies them.

Writes must remain limited to the explicitly approved fields. Protected transaction/catalog fields such as price, sale price, stock, SKU, slug, images, tags, shipping, tax, and order data must not be intentionally changed unless the user explicitly requests that scope and the production workflow is designed to protect/verify it.

After a product write, require authenticated semantic verification and public product-route verification. If reconciliation fails, preserve or run the rollback path before calling the product safe.

### Static games and applications

Static application routes are a separate deployment lane. Do not force them through WordPress.

For High Land specifically, read and follow:

- `.agents/skills/high-land-game/SKILL.md`
- `docs/deployment-hostinger.md`

High Land source:

- `apps/high-land-web`

Public route:

- `https://dtfseeds.com/games/high-land/`

Other `/games/` or application routes must remain owned by their actual static/public-suite deployment workflow unless the repository contract explicitly says otherwise.

A static app is not live merely because its build succeeded. Verify the public route, required assets, console/network behavior, and required user flow.

## Standard publishing sequence

### 1. Identify route ownership

Before editing, determine whether the target is:

- WordPress editorial content,
- THC education/infographics,
- WooCommerce product data,
- a static game/application,
- or another explicitly documented lane.

Do not use one lane to overwrite another lane's routes.

### 2. Inspect the current production mechanism

Read the relevant current workflow and script instead of recreating deployment plumbing from memory.

Check the latest `main` source, existing production status/report, and recent workflow result before making changes.

If an earlier run failed, inspect the job steps/logs and classify the failure as one of:

- source/validation failure,
- credentials/access failure,
- production write failure,
- routing/cache/static-shadow failure,
- public verification failure,
- or false-negative verifier bug.

Do not rewrite working production code when the actual problem is only a bad verifier path or stale check.

### 3. Change canonical source first

Make the desired change in the source-of-truth file(s), not only in WordPress or Hostinger.

Keep the repository able to reconstruct the live state.

Preserve unrelated files and user-authored changes.

### 4. Validate before production writes

Run the repository validators/tests that apply to the changed lane.

For scripts, syntax-check them.

For products, run genetics/commerce and reconciliation validation.

For games/apps, run their required build/tests before upload.

Do not expose secrets in logs or generated files.

### 5. Backup before mutation

All production-changing workflows must create or preserve rollback data before or around writes.

Examples include:

- WordPress page-level backups,
- theme/template presentation backups,
- WooCommerce product snapshots,
- static route/directory backups before replacement.

If no rollback path exists for a risky write, create one before proceeding.

### 6. Use the protected production lane

Prefer the existing GitHub Actions + protected production environment instead of ad-hoc manual writes.

For WordPress editorial/presentation work, reconcile canonical page records first and then reconcile the active presentation.

For WooCommerce, use the reviewed semantic production reconciliation workflow.

For static apps, use the documented static deployment workflow/runbook.

### 7. Verify the real public site

Use cache-busted requests when appropriate, for example a unique query parameter on the exact route.

Verify the positive fingerprint of the new work, not merely the absence of an old error.

Also check relevant negative/stale fingerprints such as fake contact data, old copyright, obsolete Hostinger content, staging text, or legacy navigation when those are part of the repair.

For WordPress presentation work, verify the routes covered by the workflow and confirm canonical navigation/footer state.

For an education/content release, verify unique expected text/links and child-route behavior.

For infographics, verify actual visitor-visible images/media.

For WooCommerce, verify the public product route in addition to authenticated post-write state.

For games/apps, verify required assets and functional browser behavior rather than relying only on HTML fetches.

### 8. Treat cache/search results separately

A search-engine or external crawler may show an older cached snapshot after the origin is fixed.

Do not interpret a stale search snippet as proof that the production write failed if a fresh cache-busted origin check passes. Record SEO/cache recrawl cleanup as a separate remaining task.

Conversely, do not use a stale cached success result to claim the origin is current.

### 9. Report concrete evidence

When reporting completion, include the most useful evidence available:

- commit SHA,
- workflow run ID,
- write/reconciliation outcome,
- visitor-facing verification outcome,
- rollback artifact/snapshot when relevant,
- exact public route(s) checked,
- remaining failures or unverified areas.

Never say `pushed live` when only the repository changed.

## Known lessons from the repaired production path

- The canonical WordPress publisher must not require `/games/` to exist as a WordPress page; static game routes have separate ownership.
- WordPress normalizes block markup. Presentation verification should be semantic, not byte-for-byte serialization comparison.
- A verification script can fail even after a successful production repair. Inspect the exact filename/path and expected fingerprint before deciding the deployment itself failed.
- Cache-busted public verification is stronger evidence of immediate origin state than an external crawler's older cached copy.
- Backup-first, idempotent reconciliation is preferred over destructive replacement.
- A zero-mutation successful reconciliation can be correct when production already matches canonical source.
- A transfer branch, package file, Git blob, or successful `main` commit is only an intermediate state when the user requested the change live.
- For binary assets, preserving the canonical publisher's validation and classification rules is more important than choosing the fastest transfer method.

## Completion gate

A website task is complete only when all applicable boxes are true:

- [ ] Correct route owner identified.
- [ ] Canonical source updated.
- [ ] Binary assets, if any, are valid at the canonical repository path and are not thumbnails/temporary transfer files.
- [ ] Applicable validation/tests passed.
- [ ] Backup/rollback evidence exists for production mutations.
- [ ] Production-triggering state is on current `main` without discarding concurrent work.
- [ ] Protected production write/deployment passed.
- [ ] Correct workflow run for the new content was followed to completion.
- [ ] Visitor-facing route verification passed.
- [ ] Expected new content/function/image is visible/working.
- [ ] Known stale/fake content is absent when relevant.
- [ ] Remaining unverified routes or known issues are explicitly reported.

If any applicable box is not true, continue repairing the task when possible. If a hard blocker prevents further execution, report the blocker and the last completed stage. Do not claim success.
