# DTFSeeds Responsive Layout Standard

This document is the repository-wide contract for responsive UI behavior on DTFSeeds.

The goal is not to make a desktop page "fit on mobile." The goal is to maintain one coherent product that intentionally adapts its hierarchy, density, navigation, controls, media, and reading width across different viewport sizes.

## Why this exists

DTFSeeds contains multiple presentation systems: WordPress pages, static public routes, educational shells, tools, game hubs, browser games, GrowLens, Atlas surfaces, and migration/unified-app work.

Without a shared responsive contract, page-specific CSS can easily create contradictory media queries. A common failure mode is:

1. a shared stylesheet correctly changes a grid to one column on a phone;
2. a later page stylesheet uses an overlapping breakpoint;
3. the later rule changes that grid back to two columns;
4. each stylesheet looks reasonable in isolation, but the rendered page breaks.

Responsive defects are therefore treated as system defects, not cosmetic differences.

## Canonical viewport bands

| Band | CSS width | Expected behavior |
| --- | ---: | --- |
| Small phone | 320–420 px | One reading column, compact spacing, full-width primary actions |
| Large phone | 421–700 px | One main column; limited compact two-up UI only where proven usable |
| Tablet | 701–900 px | Deliberate tablet composition, often two columns |
| Compact desktop / large tablet | 901–1120 px | Reduced desktop layout; avoid cramped full navigation |
| Desktop | 1121–1440 px | Full composition |
| Wide desktop | 1441 px+ | Capped content width; do not stretch reading lines indefinitely |

These are the shared DTF bands. Components may respond fluidly inside them.

A component-specific breakpoint is allowed only when its content demonstrably requires it. Document that reason next to the rule.

## Shared tokens and primitives

The canonical shared production layer is:

`site/wordpress/assets/responsive-layout-v1.css`

Shared concepts include:

- maximum page width;
- fluid horizontal gutters;
- reading width;
- vertical section rhythm;
- layout gaps;
- minimum touch target;
- global sticky-header height.

Prefer:

- `clamp()` for scalable type/spacing;
- `min()` and `max()` for bounded dimensions;
- `minmax(0, 1fr)` for grids;
- `min-width: 0` on grid/flex children;
- aspect ratios and `object-fit` for media;
- `100dvh` rather than only `100vh` for constrained mobile UI;
- local scroll containers for tables, code, menus, and dense controls.

Avoid fixed pixel widths for primary content shells.

## Layout ownership

Before changing responsive behavior, identify which layer owns the route.

### WordPress editorial and education shell

Shared production CSS under:

- `site/wordpress/assets/`

### Static public routes

Routes under:

- `site/public-route-patch/`

They should consume the shared shell where available and keep local CSS focused on route-specific presentation.

### Games

Game-specific CSS may control the game board/HUD, but it must respect the shared public shell and responsive contract.

### GrowLens / Atlas

Application-level styles may use their own component systems, but page-level overflow, navigation, controls, inspector panels, and embedded media must still satisfy this standard.


## Assessments, exams, and certification screens

Certification and testing UI must remain usable under time pressure on phones, tablets, compact laptops, and desktop screens.

- Answer choices are primary controls and must keep at least a 44px touch target.
- Scored exams must preserve the learner's selected answers and grade them after submission; do not require self-verification during the test.
- Timers, progress, question numbers, and candidate identity must remain visible without covering question or answer content.
- Fixed/sticky exam navigation must respect `env(safe-area-inset-bottom)` and constrained-height viewports.
- Submit, Next, Previous, Finish, and Review controls must remain reachable above browser chrome and the virtual keyboard.
- Long question/answer text, references, and validation messages must wrap without page-level horizontal scrolling.
- Tables, figures, and diagrams inside questions need local responsive containment.
- Review/grading is a distinct post-assessment state; it must not depend on the learner checking correctness while taking the exam.
- Certificate/print controls are secondary to the result state and must not obstruct completion.

## CSS load-order rule

Before introducing an override, determine the final cascade.

For the selector/property you are changing:

1. list every matching rule;
2. note each media query range;
3. identify stylesheet order;
4. note specificity and `!important`;
5. determine which declaration wins at every canonical viewport.

Do not solve cascade problems by adding progressively stronger overrides.

If two rules describe contradictory behavior at the same width, consolidate them or make their responsibilities non-overlapping.

## Component rules

### Containers

- Use a capped max width with fluid gutters.
- No primary page container should depend on a minimum viewport width.
- Wide screens should gain breathing room, not excessively long lines.

### Typography

- Use fluid heading sizes with sensible lower and upper bounds.
- Avoid viewport-only sizes that become extreme on ultrawide or very narrow screens.
- Body reading width should normally remain below roughly 72–76 characters.
- Long tokens must not force overflow.

### Grids

- Desktop column count is not the tablet column count.
- Tablet is a first-class layout state.
- Phone layouts should normally collapse content grids to one column.
- Use `minmax(0, 1fr)` so intrinsic content does not force overflow.

### Navigation

- Touch targets: at least 44 px high.
- Mobile menus must remain usable at constrained heights.
- Menus must scroll internally when needed.
- Sticky headers must not cover anchor targets or game state.

### Buttons and forms

- Primary actions should become full-width when that improves phone usability.
- Form controls must fit within their containers at browser zoom and larger text sizes.
- Labels and validation messages must wrap.

### Media

- Default: `max-width: 100%`.
- Do not let intrinsic image/canvas dimensions set page width.
- Preserve aspect ratio unless a deliberate crop is used.
- Use route-appropriate responsive image sizes.

### Tables and code

- Never make the entire page horizontally scroll because of a table or code sample.
- Put dense material inside an intentional horizontal scroll region.
- Keep the first column/header context understandable on small screens where practical.

### Dialogs, overlays, and sticky UI

- Must fit inside the current dynamic viewport.
- Must remain scrollable.
- Must not trap important controls behind browser chrome, safe areas, or the virtual keyboard.
- Verify landscape and constrained-height behavior when relevant.

### Games and canvas

- Separate game world dimensions from the surrounding responsive UI shell.
- Preserve readable HUD/control sizes.
- Touch controls cannot shrink to unusable sizes just to keep the board visible.
- Prefer responsive scaling + panning/zooming where a complex board cannot be made legible by uniform shrinking alone.

## Verification matrix

Minimum dimensions for responsive QA:

```text
360x800
390x844
430x932
844x390 (landscape phone)
768x1024
820x1180
1024x768
1280x800
1440x900
```

Add route-specific cases such as landscape phone or short laptop windows.

For every tested width verify both appearance and actual interaction.

## Automated guardrail

Run:

```bash
npm run verify:responsive
```

The checker validates that the canonical shared stylesheet retains the required breakpoint contract and resilience primitives, and that critical standalone public HTML retains a responsive viewport meta tag.

This is intentionally not a screenshot test. Rendered QA remains required under:

`.agents/skills/dtf-web-quality-gate/SKILL.md`

## Review checklist

Before approving responsive work:

- [ ] Shared layout owner inspected first.
- [ ] No unnecessary new breakpoint vocabulary.
- [ ] No contradictory overlapping rule for the same selector/property.
- [ ] Phone, tablet, compact, and desktop layouts were considered independently.
- [ ] No page-level horizontal overflow.
- [ ] Long text/media cannot force grid width.
- [ ] Touch targets remain usable.
- [ ] Sticky/overlay UI works with constrained viewport height.
- [ ] Tables/code use local scrolling.
- [ ] Zoom/text scaling does not destroy the layout.
- [ ] Reduced-motion behavior remains valid.
- [ ] `npm run verify:responsive` passes.
- [ ] Rendered QA completed at the required matrix.
- [ ] Production route verified after deployment when applicable.

## Anti-patterns

Do not introduce:

- desktop-only CSS plus one arbitrary "mobile" breakpoint;
- page-specific 600/640/700/720 px breakpoints with overlapping responsibilities and no reason;
- fixed-width cards or panels wider than common phone viewports;
- `white-space: nowrap` on user-facing content without an intentional local scroller;
- global clipping used to conceal unresolved overflow;
- absolute/fixed UI that assumes a constant browser viewport height;
- mobile rules loaded before a later stylesheet that silently reverses them;
- shrinking all game UI uniformly until controls are unreadable.

## Relationship to other skills

Use `dtf-responsive-layout` while designing or repairing the layout.

Use `dtf-web-quality-gate` to verify the rendered result.

Use `dtf-pr-reviewer` before substantive merges.

Use `dtfseeds-production-publishing` for visitor-facing deployment and live verification.
