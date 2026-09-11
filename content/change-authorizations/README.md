# Historical content change authorizations

This directory contains audit records from the previous append-only content policy.

DTF canonical content is now directly editable under `docs/CONTENT_PRESERVATION_STANDARD.md`. New authorization records are **not required** to modify, rename, reorganize, replace, or delete canonical content.

The existing JSON files remain in Git as historical records. Normal Git history is now the audit and recovery mechanism for content changes.

Do not build new editorial workflows that depend on this directory as an approval gate. Current content-integrity CI should validate data correctness, schema invariants, uniqueness, builds, and publication behavior rather than requiring SHA-bound permission files.
