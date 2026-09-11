# Approved Sitewide Header Reference — v1

Status: APPROVED VISUAL REFERENCE

Canonical reference asset: `site/wordpress/assets/design-references/dtf-course-header-approved-reference-v1.jpg`
Drive master: `DTF_Course_Header_Approved_Reference_v1.png` in `DTF Genetics Brand/Website Design References`.

## Canonical top-level navigation

The following labels, order, and hierarchy are locked for the shared site header and human-facing sitemap/navigation documentation:

1. Home
2. Seeds
3. Learn
4. Courses
5. Diagnostic
6. Games
7. Community
8. Shop

Utility actions remain separate from the primary navigation:

- Search
- Account
- Cart
- Teaching Healthy Cultivation brand/education identity

Do not rename `Seeds` to `Genetics` in the primary navigation. Do not rename `Diagnostic` to `Tools` in the primary navigation. Do not collapse `Courses` into `Learn`.

`Diagnostic` currently routes to `/tools/` because that route owns the diagnostic/tooling surface. The visitor-facing label is still `Diagnostic`.

## Required header treatment

- Full-width dark green/near-black header.
- DTF Genetics brand block at left with `Dream the Future` supporting line.
- Primary navigation uses the exact canonical row: Home, Seeds, Learn, Courses, Diagnostic, Games, Community, Shop.
- Courses uses the same header family and receives an active state on `/courses/` and Learning Hub course routes.
- Diagnostic receives the active state for `/tools/`, GrowLens, THC Grow Doc, and related diagnostic routes.
- Search, account, and cart remain compact utility actions rather than primary-navigation labels.
- `Teaching Healthy Cultivation` remains visible as the education identity when width permits.
- Thin green divider/accent at the lower header edge.
- Desktop header should feel clean, editorial, and premium rather than card-based.
- Use code-native text, links, icons, focus states, and responsive behavior. Do not ship the screenshot itself as the header UI.

## Responsive behavior

The labels and information architecture do not change by device. Only presentation changes.

### Desktop

- Keep all eight primary destinations in one horizontal row when they fit comfortably.
- Keep Search, Account, Cart, and Teaching Healthy Cultivation grouped at the right.
- Do not allow navigation labels to wrap.

### Tablet / compact desktop

- Preserve the brand and utility icons.
- Collapse the eight primary destinations behind the Menu control before the row becomes cramped.
- Expanded navigation may use a multi-column panel.
- Touch targets must be at least 44px high.

### Mobile

- Keep the DTF Genetics brand visible.
- Keep Search, Account, Cart, and Menu available in the header.
- The expanded menu must show all eight canonical destinations with the same wording and order.
- Use two columns when practical and one column on very narrow screens.
- Never hide Courses or merge it into Learn.

## Canonical human-facing sitemap roots

```text
DTF Genetics
├── Home
├── Seeds
├── Learn
├── Courses
├── Diagnostic
├── Games
├── Community
└── Shop
```

Deeper pages live beneath these roots, but every new public page should have one clear primary owner among these sections so breadcrumbs, active navigation, responsive menus, and route auditing stay consistent.

## Fidelity rule

The approved concept is the visual source of truth for proportions, dark palette, spacing rhythm, nav density, active-state treatment, brand hierarchy, and course-site continuity. The screenshot may be shown in internal design documentation, but production UI must remain semantic HTML/CSS and accessible.
