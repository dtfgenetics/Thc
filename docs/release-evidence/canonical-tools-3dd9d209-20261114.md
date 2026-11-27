# Canonical Tools integration evidence — 2026-11-14

## Source identity
- Canonical author: `dtfgenetics/Tools`.
- Requested canonical mirror commit: `3dd9d2090cad6288ee14079c03976f566d84ee19`.
- Original automated mirror branch: `work/platform/canonical-tools-sync/automation`.
- Generated mirror commit copied into this review branch (without editing route or asset files): `6bdc89cedaba238dcd496556555782113c100fc4`.
- Site integration pin before review: `a0b6eb441f2cdc801423a8b899d988c6ac1e998c`.

## Publication scope
The generated sync changes these eight files only (before this documentation):
- `site/public-route-patch/assets/release-source-revisions/tools.txt`
- `site/public-route-patch/assets/thc-light-lab-math-v1.mjs`
- `site/public-route-patch/co2-ventilation/index.html`
- `site/public-route-patch/ppfd-chart/index.html`
- `site/public-route-patch/root-zone-temperature/index.html`
- `site/public-route-patch/science-labs/index.html`
- `site/public-route-patch/tools/index.html`
- `site/public-route-patch/vpd-chart/index.html`

The review branch does not overwrite `/learn/atlas/` or replace expanded Atlas lessons. The mirror guard must prove byte-for-byte parity against the pinned canonical commit.

## Review lane and verification
- Corrected protected review branch: `work/platform/canonical-tools-review/20261114` (PR #2566). The previous review PR #2565 had invalid three-segment project-lane naming; this is a branch-policy correction, not a relaxation.
- Revalidate checks at the exact new head; the old `action_required` workflow conclusions and the invalid-lane run cannot authorize a release.

## Release decisions: fail closed
- Existing auto-generated PR #2561 received GitHub workflow conclusions `action_required` for every check at its refreshed head. Those are **not** passing tests.
- A previous tested mirror head passed source parity, CodeQL and package-building checks, but its **Web quality system failed** when real Chrome navigated to `https://dtfseeds.com/` and received HTTP **403**.
- The browser diagnostic captured `server: hcdn` and a real Chrome document response status 403. Node fetch from the same CI runner received 200. It does not establish a specific hosting security rule.
- **Do not bypass or waive** browser performance/accessibility testing, remove the seed-sales hold, or claim public deployment because a PR compiles or merges.
- Require successful exact-head canonical mirror, build, CodeQL, responsive, WordPress registry and deployment CI. For a true live release, require browser-visible content, real calculator interactions, MIME checks, and deployed SHA evidence.

Tracked blockers: `dtfgenetics/Thc#2510`, `dtfgenetics/Thc#2562`, and `dtfgenetics/Tools#210`.
