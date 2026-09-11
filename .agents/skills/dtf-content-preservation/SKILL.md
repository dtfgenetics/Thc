# DTF Canonical Content Integrity Skill

Use this skill whenever adding, expanding, revising, importing, reconciling, reorganizing, or publishing durable DTF educational/content records.

Read `docs/CONTENT_PRESERVATION_STANDARD.md` and `configuration/content-preservation-policy.json` before changing canonical content.

## Core rule

**Canonical content is editable. Preserve unrelated work, but do not treat earlier content, file placement, lesson counts, or old authorizations as locks on current product work.**

Current explicit project direction may add, revise, rename, move, merge, split, replace, or delete canonical records. Git history preserves previous states for audit and recovery.

## Editing workflow

1. Inspect the current canonical source, IDs, dependent indexes, publishers, and tests that are relevant to the requested change.
2. Make the content or structural change needed to achieve the current goal.
3. Keep remaining structured records valid and unique according to their current schema.
4. Update derived catalogs, manifests, navigation, search indexes, tests, or publication mappings as needed.
5. Run `node scripts/validate-append-only-content.mjs <base> <head>` or rely on `Canonical Content Integrity` in PR CI.
6. Run the owning build/test pipeline.
7. Publish through the route-owning production workflow when live state is requested.
8. Verify the real visitor-facing route before calling the revision live.

No separate SHA authorization file is required for an ordinary edit, rename, replacement, deletion, or reorganization.

## Publication rule

Canonical authored records, derived indexes, and publication state are separate concerns.

- Canonical records are directly editable source.
- Derived indexes/catalogs/search data may be regenerated.
- Publication state may be retried or reconciled.
- A partial batch or stale `current-*` cursor must not accidentally remove unrelated canonical source unless that removal is part of the requested change.

## Integrity requirements that remain

Do not weaken genuine correctness or security controls merely to make editing easier. Continue to protect:

- valid structured data and schema invariants;
- unique IDs/numbers where the current schema requires them;
- authentication and authorization;
- secrets and private data;
- rollback/recovery for risky production mutations;
- truthful build/deployment verification;
- visitor-facing acceptance checks.

These are integrity protections, not editorial restrictions.

## When expanding the system

Additional libraries such as Academy courses, SOPs, beginner guides, glossary entries, tests, and certifications may be added to `configuration/content-preservation-policy.json` when structural validation is useful.

Do not introduce arbitrary content caps, fixed lesson limits, immutable file-placement rules, or per-edit approval artifacts. If the architecture needs to change, update the policy, validator, indexes, and publishers to match the new architecture.

## Completion test

Do not report a content task complete until:

- the requested additions/revisions/reorganizations are represented in canonical source;
- remaining IDs/schema invariants are valid;
- derived indexes include the intended current content;
- the content-integrity validator passes;
- the owning build/publisher succeeds when applicable;
- the real public route contains the intended result when publication was requested.
