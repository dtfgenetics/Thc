# Technology-to-tool reconciliation

Run `node scripts/report-technology-ownership.mjs` to cross-reference proposed external technologies against the authoritative `data/tool-execution-registry.json`.

The output has `mapped` and `unmatched` groups. Unmatched is **not an error**: technologies intended for general publishing, code review, or education may not correspond to a public cultivation route. Even mapped candidates require manual ownership review; keyword matching never authorizes code changes.

Use the execution registry to decide which repository to edit and verify in that canonical repository before syncing deployment artifacts. Avoid installing unreviewed skills/plugins or copying source from unverified licenses.

This command reads local JSON only; it does not clone dependencies or connect to external services.
