# DTF Content Preservation Standard

## Purpose

DTF content libraries must be able to grow for years without routine publication, indexing, automation, or AI-assisted editing erasing earlier work.

The repository therefore uses an **append-first, preserve-by-default** content model.

## Layer model

### 1. Canonical authored records

These are the source of truth for authored content. They are individual, addressable records such as encyclopedia lessons.

Example:

- `content/encyclopedia/volume-14/lessons/thc-enc-280.json`

Rules:

- New canonical records are added as new files.
- Existing canonical records are immutable by default.
- IDs and record numbers must remain unique.
- Existing records may only be modified, renamed, or deleted when an explicit change authorization is committed with the same change.
- An authorization must bind to the exact previous and replacement SHA-256 hashes, so an old approval cannot authorize a later unrelated edit.

### 2. Derived indexes, catalogs, manifests, and search data

These files organize canonical records for navigation, discovery, builds, or publication.

Examples include:

- encyclopedia catalogs;
- volume manifests;
- search indexes;
- topic indexes;
- release manifests;
- generated navigation.

Derived files may be regenerated as the library grows. They must not become the only copy of authored content and must never be treated as permission to delete canonical records that are absent from a generated subset.

A publisher must build from the complete intended canonical collection or from an explicit append/replay manifest. A mutable pointer such as `current-production-batch.json` is a cursor, not the historical source of truth.

### 3. Publication state

Publication state records what has been attempted, published, verified, retried, or rolled back. It is operational state, not authored source.

Publication automation must be idempotent and should prefer reconciliation:

1. read canonical records;
2. discover current production state;
3. add or update only the explicitly targeted records;
4. preserve unrelated published records;
5. verify visitor-facing output;
6. rollback the current transaction if its acceptance gate fails.

A failed publication must not advance the durable source-of-truth in a way that makes unpublished records appear completed.

## Normal content growth

Adding information should normally look like this:

1. Create a new canonical record with a new ID/number.
2. Add it to the appropriate volume/topic/release manifest.
3. Regenerate derived indexes as needed.
4. Run validation.
5. Publish through the owning production lane.
6. Verify the exact public route/content.

No authorization file is needed for a pure addition.

## Revising existing content

When the project owner explicitly requests a correction, replacement, merge, deletion, or rename of existing canonical content:

1. Identify the exact existing file(s).
2. Preserve the old Git history; never rewrite repository history.
3. Calculate the previous SHA-256 hash.
4. Make the requested change.
5. Calculate the new SHA-256 hash when the record remains present.
6. Add a new JSON authorization record under `content/change-authorizations/`.
7. Include the explicit instruction reference and reason.
8. Let `Content Preservation Contract` verify that the authorization exactly matches the bytes being changed.

Authorization records are themselves append-only audit history.

## What automation must never do by default

Automation, agents, publishers, generators, and reconciliation scripts must not do any of the following merely because a newer batch or index omits old content:

- truncate a canonical library;
- replace a whole collection from a partial batch;
- reuse an existing canonical ID for different content;
- renumber existing records;
- delete an old lesson because a newer catalog does not list it;
- interpret `current-*` pointers as complete historical inventories;
- overwrite existing records as a side effect of adding new ones;
- mark a batch successfully published before visitor-facing verification passes.

## CI enforcement

The repository-level policy lives at:

- `configuration/content-preservation-policy.json`

The validator is:

- `scripts/validate-append-only-content.mjs`

The GitHub Actions contract is:

- `.github/workflows/content-preservation-contract.yml`

The first protected collection is the THC Encyclopedia lesson library. Additional content libraries should be added to the policy as they are migrated to canonical per-record storage.

## Migration pattern for other libraries

For Academy courses, SOPs, beginner guides, glossary records, genetics education, and future libraries:

1. split durable authored content into stable per-record source files where practical;
2. assign stable unique IDs;
3. add the collection path and identity rules to `content-preservation-policy.json`;
4. keep generated indexes separate from canonical records;
5. update the owning publisher to reconcile additions instead of replacing the entire public collection;
6. add visitor-facing acceptance checks.

This makes the system additive by default while still allowing deliberate corrections when the project owner specifically authorizes them.
