# Responsive Layout Audit — 2026-09-27

## Scope
Public DTFSeeds surfaces on mobile, tablet, compact desktop, and wide desktop.

## What is going wrong

### 1. Multiple responsive owners
The site currently layers:
- page-local responsive CSS;
- `responsive-layout-v1.css`;
- `sitewide-ux-polish-v1.css`;
- the V6 header mobile-polish style;
- route-specific game/tool styles.

These layers overlap but do not all cover the same page families. The result is inconsistent gutters, breakpoints, hero behavior, sticky offsets, and card/grid collapse behavior.

### 2. Conflicting layout widths
The canonical layout system declared a 1360px maximum while the UX layer independently declared 1280px. Different page families therefore resolved to different content widths on desktop.

**Fix:** UX polish now inherits `--dtf-layout-max`.

### 3. Conflicting mobile header height
The shared responsive layer declared a 74px phone header while the canonical V6 mobile header uses 66px.

**Fix:** the phone responsive contract and scroll-padding fallback now use 66px.

### 4. V3 and DTF V1 pages were not fully owned by the canonical responsive layer
Home/Learn V3 and several DTF V1 surfaces depended on later polish overrides rather than the base responsive contract.

**Fix:** responsive-layout now explicitly provides:
- shrink-safe boxes;
- canonical containers;
- responsive hero/media limits;
- tablet single-column collapse;
- phone single-column grids;
- image containment;
- safe text wrapping.

### 5. Dense content can become visually overwhelming even when technically responsive
The Learn page currently contains goal selection, learning map, expanded references, reference desk, foundations, specialized subjects, depth choices, and diagnostics on one long surface. The Courses page similarly presents multiple hierarchy levels and pathway metadata. These pages can fit the viewport and still be hard to understand.

**Fix direction:** pair responsive repair with the site-clarity work: primary task first, secondary material progressively disclosed.

### 6. Static tools and games can drift
Many static public pages carry local CSS, so shared WordPress fixes do not automatically protect them.

**Fix:** added `npm run audit:responsive-source` to scan public route sources for:
- missing viewport meta;
- no mobile breakpoint;
- 100vw overflow risk;
- large fixed min-width;
- grids that may not shrink safely;
- sticky UI not using the global header-height contract;
- hidden horizontal overflow that may conceal dense content.

## Layout contract

### Wide desktop >1120px
- consistent 1360px maximum content container;
- readable prose remains constrained;
- hero media does not dominate the page;
- card grids use minmax(0,1fr);
- section hierarchy remains obvious.

### Tablet / compact desktop 701–1120px
- two-column grids only where content remains readable;
- hero and complex split layouts collapse by 900px;
- no desktop-only fixed-width sidebars;
- controls retain minimum touch size.

### Mobile 421–700px
- canonical 66px header contract;
- one reading column;
- full-width primary actions;
- horizontal shortcut rails only when useful;
- media cannot exceed the content width;
- dense tables must scroll intentionally rather than being clipped.

### Narrow mobile <=420px
- reduced gutter;
- no unnecessary card minimum heights;
- compact but readable titles;
- 44px+ interactive targets.

## Next repair order
1. Shared responsive contract (this branch).
2. Home / Learn / Courses / Tools visual hierarchy.
3. Static tool hubs and individual calculators.
4. Game hub and game-specific HUD/sticky layouts.
5. Community, Shop, account, and commerce routes.
6. Live device-width verification after deployment.

## Production rule
Do not fix a repeated responsive defect separately on each page. Repair the highest shared owner first, then page-specific exceptions only when necessary.

## CI repair and branch reconciliation

After the responsive/composition repairs, CI exposed several stale validation assumptions rather than user-facing regressions. The course catalog again states post-submit grading behavior explicitly; Pheno Draft validation follows the canonical runtime module; the education image-derivative builder treats a visual library with no current image tags as a valid no-op while still failing missing referenced assets; and the PhenoQuest live verifier tolerates the 74px-to-66px header fallback migration while still requiring header clearance.

The branch was then reconciled with the latest `main` commits. The upstream Public Suite shared-asset allowlist and pinned Grow Doc source revision were merged without replacing the responsive/tool work. After reconciliation the branch is zero commits behind `main` and ready for a fresh validation run.
