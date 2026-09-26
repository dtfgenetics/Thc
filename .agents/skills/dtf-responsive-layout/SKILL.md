---
name: dtf-responsive-layout
description: >
  Design, repair, and review responsive DTFSeeds layouts across phones, tablets,
  laptops, desktops, wide displays, and constrained-height viewports. Use before
  changing shared CSS, page shells, course layouts, tools, game hubs, navigation,
  cards, tables, forms, modals, canvases, or any UI that can change across viewport sizes.
metadata:
  author: dtfgenetics
  version: "1.0.0"
---

# DTF Responsive Layout

Use this skill for every substantive visitor-facing layout or CSS change.

The responsive system is a shared product contract. Do not fix one viewport by breaking another, and do not add page-local breakpoints before checking the shared layout layer.

## Source of truth

Read first:

- `docs/RESPONSIVE_LAYOUT_STANDARD.md`
- `site/wordpress/assets/responsive-layout-v1.css`
- `.agents/skills/dtf-web-quality-gate/SKILL.md`

For production changes also read:

- `.agents/skills/dtfseeds-production-publishing/SKILL.md`

## Canonical viewport bands

Treat these as behavioral bands, not device-brand assumptions:

- small phone: 320–420 CSS px
- large phone: 421–700 CSS px
- tablet: 701–900 CSS px
- compact desktop / large tablet: 901–1120 CSS px
- desktop: 1121–1440 CSS px
- wide desktop: above 1440 CSS px, with capped content widths

Use content-driven fluid sizing inside the bands. Prefer `clamp()`, `min()`, `max()`, `minmax(0, 1fr)`, intrinsic sizing, and shared layout tokens.

## Required implementation rules

1. Inspect shared CSS before adding a new media query.
2. Reuse the canonical bands unless a component has a documented content-driven reason for a local breakpoint.
3. Never assume desktop + one mobile breakpoint is sufficient.
4. Grid/flex children that may contain long text or media must be allowed to shrink with `min-width: 0`.
5. Images, video, SVG, canvas, and iframe surfaces must not force page overflow.
6. Long URLs, labels, lineage strings, source names, and generated text must wrap safely.
7. Tables and code blocks must use an intentional scroll container instead of forcing the whole page wider.
8. Primary touch controls must be at least 44 CSS px high unless the control is inherently inline text.
9. Mobile navigation, dialogs, inspectors, scoreboards, and sticky panels must fit within `100dvh` and remain scrollable.
10. Do not hide required content merely to make a narrow layout fit.
11. Do not use global `overflow-x:hidden` as the only fix for a child that is actually too wide. Fix the source of overflow.
12. Games and canvas/WebGL surfaces need a responsive shell around the runtime. Canvas scaling must not make controls unreadable or untouchable.
13. Prefer one shared correction over duplicate page-specific overrides.
14. When a page needs a local override, scope it narrowly and document why the shared rule is insufficient.
15. Keep responsive behavior compatible with reduced motion, zoom, text-size changes, keyboard focus, and browser UI height changes.

## Conflict-prevention rule

Before adding or changing any media query:

1. search the relevant CSS load order;
2. find all rules affecting the same selector/property;
3. identify which stylesheet loads last;
4. compare overlapping viewport ranges;
5. remove or reconcile contradictory declarations instead of stacking another override.

A later stylesheet that silently reverses an earlier mobile rule is a defect even when both files look correct in isolation.

## Required QA matrix

For any substantive layout change, inspect at minimum:

- 360 × 800
- 390 × 844
- 430 × 932
- 768 × 1024
- 820 × 1180
- 1024 × 768
- 1280 × 800
- 1440 × 900

Also test one constrained-height viewport when sticky navigation, dialogs, game HUDs, or overlays are involved.

At each viewport verify:

- no unexpected page-level horizontal scroll;
- header/navigation remains usable;
- headings do not collide or clip;
- cards/grids reflow intentionally;
- buttons/inputs remain reachable and touchable;
- images/media preserve useful crops;
- tables/code have local scrolling if needed;
- fixed/sticky elements do not cover primary content;
- footer remains readable;
- keyboard focus remains visible;
- primary interaction still works.

## Deterministic verifier

Run:

```bash
npm run verify:responsive
```

This verifies the canonical responsive contract and catches common regressions. It supplements rendered QA; it does not replace it.

## Release handoff

After implementation:

1. run `npm run verify:responsive`;
2. run the relevant product tests/builds;
3. follow `dtf-web-quality-gate` for rendered desktop/tablet/mobile QA;
4. follow the repository PR review process;
5. for production work, follow `dtfseeds-production-publishing`;
6. never call the work live until the public route is verified after deployment.
