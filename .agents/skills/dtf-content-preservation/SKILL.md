# DTF Content Preservation Skill

Use this skill whenever adding, expanding, revising, importing, reconciling, or publishing durable DTF educational/content records.

Read `docs/CONTENT_PRESERVATION_STANDARD.md` and `configuration/content-preservation-policy.json` before changing canonical content.

## Core rule

**Append by default. Preserve existing work unless the project owner explicitly requested that specific existing content be revised, renamed, merged, replaced, or deleted.**

A newer batch, generated index, `current-*` pointer, publication manifest, WordPress response, or AI-generated replacement is never implicit permission to remove older canonical content.

## Normal addition workflow

1. Inspect current canonical records and IDs first.
2. Allocate a new stable ID/number; never reuse one already present.
3. Add the new record as a new file when the collection uses per-record storage.
4. Update derived catalogs/manifests only to include the addition; do not rebuild them from an incomplete subset.
5. Run `node scripts/validate-append-only-content.mjs <base> <head>` or rely on `Content Preservation Contract` in PR CI.
6. Publish through the route-owning production workflow.
7. Verify the new content on the real visitor-facing route before claiming it is live.

Pure additions require no override authorization.

## Explicit revision workflow

If and only if the user explicitly requests changing existing protected content:

1. Identify the exact canonical file and current bytes.
2. Preserve Git history; do not rewrite or force-push history.
3. Compute the old file SHA-256.
4. Make only the requested revision.
5. Compute the new SHA-256 when the file remains present.
6. Add a new immutable authorization JSON under `content/change-authorizations/`.
7. Include `authorizedBy`, `instructionRef`, a meaningful reason, the action, exact path, and exact hashes.
8. Let repository CI prove the authorization matches the actual diff.
9. Publish and visitor-verify the revision through the owning production lane.

Do not reuse or edit an old authorization record.

## Publication rule

Canonical authored records, derived indexes, and publication state are separate layers.

- Canonical records preserve the authored work.
- Derived indexes/catalogs/search data may be regenerated.
- Publication state may be retried/reconciled.

A mutable `current-production-batch.json` or similar cursor is not a complete historical inventory. A failed publication must not cause later automation to skip unpublished canonical records.

## When expanding the system

Before making another durable library additive-by-default, migrate it to stable per-record source files where practical, then add its path/identity rules to `configuration/content-preservation-policy.json`.

Candidate libraries include Academy courses, SOPs, beginner guides, glossary entries, and future educational collections.

## Completion test

Do not report a content task complete until:

- previous canonical records remain present unless explicitly authorized otherwise;
- new IDs are unique;
- the preservation validator passes;
- derived indexes include the intended additions;
- the correct production publisher succeeds;
- the real public route contains the new/revised content.
