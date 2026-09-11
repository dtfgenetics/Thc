# DTF Canonical Content Integrity Standard

## Purpose

DTF content libraries must stay fully editable and extensible while remaining reliable enough to publish, search, migrate, and recover.

The repository therefore uses an **editable-with-Git-history** model. Canonical authored content can be added, revised, renamed, reorganized, replaced, or deleted when the work calls for it. A separate authorization file is not required to make an ordinary content change.

Git history is the durable audit trail. CI protects structural integrity, not editorial immutability.

## Layer model

### 1. Canonical authored records

These are source records such as encyclopedia lessons, course lessons, tests, glossary entries, and other durable educational content.

Rules:

- New records may be added.
- Existing records may be edited directly.
- Records may be renamed, moved, merged, split, replaced, or deleted when appropriate.
- IDs and record numbers that remain in the current canonical collection must satisfy the collection schema and remain unique.
- JSON and other structured source must remain parseable and internally consistent.
- Do not rewrite Git history merely to hide an old version; normal commits preserve the previous state for recovery.

### 2. Derived indexes, catalogs, manifests, and search data

These files organize canonical records for navigation, discovery, builds, or publication.

Derived files may be regenerated freely. They must not be mistaken for the only authored source unless the architecture intentionally changes to make them canonical.

A partial batch, stale generated index, or `current-*` pointer must not accidentally erase unrelated source during automation. That is a data-integrity rule, not an editing restriction.

### 3. Publication state

Publication state records what was attempted, published, verified, retried, or rolled back. It is operational state rather than editorial authority.

Publication automation should remain recoverable and idempotent:

1. read intended source;
2. discover current production state;
3. apply the requested change;
4. preserve unrelated data unless the change intentionally replaces it;
5. verify visitor-facing output;
6. rollback the current transaction when an acceptance gate fails.

## Editing workflow

For additions, corrections, rewrites, reorganizations, or removals:

1. Inspect the current source and dependent indexes/builders.
2. Make the product/content change needed to achieve the current goal.
3. Update derived indexes, manifests, navigation, tests, or search data as required.
4. Run the canonical content-integrity validator.
5. Run the owning build/test pipeline.
6. Publish through the owning production lane when live state is requested.
7. Verify the exact visitor-facing result before calling the work live.

No SHA-bound authorization JSON is required.

## Integrity checks that remain

Removing editorial locks does not mean removing correctness checks. CI should still reject:

- malformed JSON or invalid structured records;
- duplicate IDs or duplicate record numbers where uniqueness is required;
- ID/number mismatches defined by a collection schema;
- invalid build artifacts;
- broken route/index references;
- credential exposure or private-data leakage;
- deployment failures reported as successes.

These checks protect correctness and security without preventing legitimate editing.

## Historical change-authorization records

`content/change-authorizations/` may remain in Git as historical project records from the previous append-only policy. New records are not required for ordinary content edits, and those historical files are not an authorization gate.

## CI enforcement

Policy:

- `configuration/content-preservation-policy.json`

Validator:

- `scripts/validate-append-only-content.mjs`

The validator filename is retained for compatibility with existing automation, but its behavior is now editable-content integrity validation.

Workflow:

- `.github/workflows/content-preservation-contract.yml`

The workflow validates current canonical integrity and no longer blocks modifications, deletions, or renames solely because an authorization artifact is absent.

## Expanding to other libraries

Academy courses, SOPs, beginner guides, glossary records, genetics education, tests, certifications, and future libraries may be added to the policy when structural validation is useful. Doing so must not introduce arbitrary content-count caps, fixed lesson limits, or per-edit approval files.

Content structure may evolve. Update the schema, validator, and publishers together when the product architecture changes.
