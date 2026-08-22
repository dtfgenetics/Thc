---
name: dtfseeds-production-repair
description: Safely diagnose, repair, publish, and verify dtfseeds.com WordPress/Hostinger production changes using the proven Codex pattern: trusted source control, protected GitHub Actions, WordPress REST, transactional rollback, Hostinger cache purge, and independent live verification.
---

# DTFSeeds production repair workflow

Use this skill for any dtfseeds.com production repair, WordPress page/theme/media publish, stale route, static-shadow cleanup, Hostinger routing/cache issue, or deployment where repository changes must become verifiably live.

## Read first

1. Read `AGENTS.md`, `CLAUDE.md`, and `README.md`.
2. Read `docs/deployment-hostinger.md` and `docs/TOOL_CONNECTIONS.md` when present.
3. Inspect the relevant source-controlled page/assets/scripts/workflows before changing production.
4. Inspect recent GitHub Actions results and the current public route separately. Do not assume repository state equals live state.

## Proven Codex production pattern

Follow this sequence unless a narrower existing workflow already satisfies it:

1. **Diagnose before mutating.** Identify whether the defect is repository content, WordPress data, WordPress template/rendering, static filesystem shadowing, rewrite precedence, cache, or a separate application route.
2. **Keep the fix in source control.** Put repair logic in `scripts/` and execution logic in `.github/workflows/`; do not rely on undocumented manual production edits.
3. **Use trusted `main`.** Production workflows must check out trusted `main` and use the protected `production` environment for credentials.
4. **Prefer the existing WordPress application-password REST lane.** Use WordPress REST for pages, media, settings, templates, template parts, and plugin management when supported. Do not require SSH merely because older deployment workflows mention it.
5. **Use a trusted dispatcher when registration/triggering is unreliable.** A small workflow with `actions: write` may run `gh workflow run <target>.yml --ref main`. For dependent stages, wait for the target run and require success before dispatching the next stage.
6. **Back up before every production mutation.** Save the exact prior state plus an integrity hash. For WordPress REST content, preserve returned records/JSON. For filesystem or rewrite changes, preserve exact bytes, permissions when relevant, and SHA-256 before writing.
7. **Make the smallest deterministic change.** Validate exact IDs, slugs, paths, current markers, or expected directives before changing anything. If assumptions do not match production, fail without mutation.
8. **Use temporary WordPress-side filesystem access only when necessary.** If REST cannot directly reach a required file, WordPress core plugin REST may temporarily install/activate Code Snippets and register a token-protected, `manage_options`-restricted repair endpoint. The endpoint must only touch explicitly approved paths/directives, must verify backups first, and must remove its temporary code/plugin state after success. Never expose the repair token or application password.
9. **Treat routing and static shadows as separate layers.** Before deleting an `index.html` or section shadow, inspect `.htaccess`, `DirectoryIndex`, rewrite rules, WordPress direct renders, and the exact shadow file markers. Removing a file is not a routing fix if the request will 404 or another stale WordPress render remains underneath.
10. **Purge cache after mutations that affect rendered output.** Use WordPress cache flush hooks when available and the authenticated Hostinger MCP LiteSpeed cache flush as a best-effort second layer. Cache purge does not replace verification.
11. **Verify through multiple gates.** A production-success claim requires all applicable gates below.
12. **Rollback automatically on failed verification.** If a transaction changed production and the required live checks fail, restore the exact backup, purge caches again, verify restoration when possible, and report failure.
13. **Record evidence.** Production workflows should report run ID, stage outcomes, mutation count/paths, rollback status, and live verification to the existing deployment issue or another explicit release record. Never print secret values.

## Required verification gates

Use each applicable gate and keep them separate:

### Gate A — source/repository

- Intended code/content is committed to trusted `main`.
- Repair/workflow syntax checks pass.
- The production workflow is the version expected by the commit.

### Gate B — WordPress REST source of truth

- Expected page IDs/slugs/status/content are present.
- Expected theme templates/template parts contain the current structure.
- Stale markers are absent from the canonical REST records being published.

### Gate C — direct WordPress render

When routing/render ambiguity exists, probe WordPress directly (for example `/index.php`, a page ID, or another safe origin-style route) with cache-busting query parameters. Determine whether WordPress itself renders current or stale content before blaming static files.

### Gate D — filesystem/rewrite state

When file-level behavior is in scope:

- Confirm the exact candidate file/directive exists.
- Confirm marker/content match before mutation.
- Confirm backup integrity.
- Confirm the expected file/rewrite state after mutation.
- Do not delete unrelated files or broaden a rule to unknown paths.

### Gate E — visitor-facing live route

For every changed public route:

- Fetch the real `https://dtfseeds.com/...` route with a unique cache-busting query.
- Require HTTP success unless the route intentionally redirects.
- Require at least one route-specific **current marker**.
- Reject all known **stale markers** for that route.
- When visual publishing is in scope, verify expected WordPress-hosted image references or other concrete visual evidence.
- Repeat with bounded retries because Hostinger HTTPS/cache propagation can be intermittent.

Local success, REST success, a successful cache purge, or a successful GitHub dispatch alone does **not** prove the public site is fixed.

## Static-shadow and rewrite safety contract

For stale `index.html` or section-level HTML shadows:

1. Run a read-only filesystem diagnostic first.
2. Record exact paths, size/hash, writability, and marker matches.
3. Inspect `.htaccess` and `DirectoryIndex` before deletion.
4. Test route precedence transactionally before permanently retiring the shadow.
5. If removing the shadow reveals a 404 or another stale render, restore it and diagnose the next layer instead of finalizing deletion.
6. Finalize deletion only after WordPress owns the route and visitor verification passes.

## Failure handling

- Never claim success when a required gate is failed, skipped, stale, or only inferred.
- Distinguish **deployment executed** from **deployment verified live**.
- If Hostinger/GitHub networking times out, use bounded retry/backoff around idempotent operations rather than changing architecture immediately.
- If a verifier is wrong, fix the verifier and rerun; do not alter correct production content to satisfy a bad test.
- If rollback fails, stop cleanup of temporary recovery tooling and report the recovery state explicitly.
- Preserve unrelated/user-authored files and changes.

## Reuse for the rest of the site

For each remaining route or feature, supply a small route contract before running the pattern:

- repository source path(s)
- WordPress page/template/media identifiers if applicable
- public URL(s)
- current marker(s) that must appear
- stale marker(s) that must disappear
- minimum image/media expectations when relevant
- filesystem paths/directives only if positively identified
- rollback source and integrity check

Then execute the same diagnose → source-control → protected publish → backup → minimal mutation → purge → multi-gate verify → finalize/rollback sequence.

## Reporting format

Report:

- **Repository:** commit(s) and changed files
- **Production execution:** workflow/run and protected environment status
- **WordPress verification:** PASS / FAIL / NOT TESTED
- **Filesystem/routing verification:** PASS / FAIL / NOT APPLICABLE
- **Live public verification:** PASS / FAIL / NOT TESTED
- **Rollback:** not needed / completed / failed
- **Remaining blocker:** exact next layer, not a guess

Do not use the word “fixed” or “live” unless the visitor-facing gate passed on the current production state.
