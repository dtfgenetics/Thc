# Legacy Asset Provenance Hold

Date: 2026-09-30
Legacy repository: `dtfgenetics/dtf-thc-hub`
Canonical integration repository: `dtfgenetics/Thc`

## Why this hold exists

A SHA-level comparison found no byte-identical copies of the checked-in legacy asset set in `Thc`, `thc-grow-hub`, `Tools`, or `Thc-dataset`.

That does **not** mean every file is still production-worthy. Some are older exports or source sheets. It means the legacy repository must not be archived until each unique binary is mapped to a canonical derivative, retained as provenance, or explicitly superseded.

## Unique legacy asset groups

### High Land source/release art

Legacy files:
- `assets/games/high-land/high-land-board.jpg`
- `assets/games/high-land/hit-cards/hit-cards-01.png` through `hit-cards-05.png`
- former duplicate copies under `packages/shared-ui/src/high-land/assets/` (removed after SHA parity verification in `dtfgenetics/dtf-thc-hub` PR #55)

Observed status:
- canonical High Land now uses `apps/high-land-web/public/assets/images/board/high-land-board.png`;
- canonical HIT cards are individual master assets rather than the older sheet-based runtime;
- canonical deck documentation currently reports 31 PNG masters and temporary SVG art debt for cards 032–039;
- the legacy package-level board and five HIT-card sheet binaries were byte-identical to `assets/games/high-land/` and were removed from the active legacy package tree in `dtfgenetics/dtf-thc-hub` PR #55; one provenance copy remains under `assets/games/high-land/`.

Decision:
- do not restore the legacy sheet-based game runtime;
- retain the sheet images as provenance/source material until the canonical High Land asset inventory records whether each live card was derived from these sheets;
- do not claim the legacy sheets solve the current 032–039 art debt without an explicit visual/content match;
- one retained archival copy is enough; duplicate package-level copies have now been removed. The remaining work is only the sheet-to-current-master provenance mapping, not binary deduplication.

### Brand and UI SVGs

Legacy unique files:
- `assets/brand/dtf-mark.svg`
- `assets/ui/favicon-dtfseeds.svg`
- `assets/ui/favicon-dtf420.svg`

Decision:
- these three SVGs are explicitly **superseded legacy assets** and do not need migration into a canonical runtime;
- current production branding/favicons use newer systems: `dtfgenetics/Thc` generates the THC pot-leaf favicon through `scripts/generate-dtf-thc-favicon.mjs`, while the transitional `dtfgenetics/Dtf420` application renders its current favicon through `app/favicon/route.tsx`;
- no active canonical code path found during this review references the legacy SVG filenames;
- preserve their history in `dtf-thc-hub` Git history until that repository is archived; they are not blockers to archive readiness.

## Empty placeholders

Legacy `.gitkeep` files and empty asset folders have no preservation requirement once the repository itself is retained in Git history.

## Archive gate

The asset lane is complete only when:
1. every non-placeholder legacy binary is mapped to a canonical asset, provenance archive, or explicit superseded record;
2. the High Land sheet-to-master relationship is documented;
3. current High Land cards 032–039 have approved final art or remain separately tracked as canonical art debt;
4. ~~brand/UI SVGs are either adopted canonically or explicitly retired~~ — complete: explicitly superseded on 2026-09-30;
5. no production build references the legacy repository path directly.
