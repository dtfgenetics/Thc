# Approved Sitewide Header Reference — v2

Status: APPROVED VISUAL + INFORMATION-ARCHITECTURE REFERENCE

Canonical visual reference asset: `site/wordpress/assets/design-references/dtf-course-header-approved-reference-v1.jpg`
Drive visual master: `DTF_Course_Header_Approved_Reference_v1.png` in `DTF Genetics Brand/Website Design References`.

The image remains the visual reference for palette, spacing, active-state treatment, brand hierarchy, and course-site continuity. The current information architecture below supersedes obsolete navigation wording visible in older screenshots.

## Canonical top-level navigation

The following six labels, order, and hierarchy are locked for the shared site header and human-facing sitemap/navigation documentation:

1. Genetics → `/seeds/`
2. Learn → `/learn/`
3. Tools → `/tools/`
4. Games → `/games/`
5. Community → `/community/`
6. Shop → `/shop/`

The DTF Genetics brand links to Home (`/`), so `Home` is not duplicated as a primary-navigation label.

Utility actions remain separate from the primary navigation:

- Search
- Account
- Cart
- Teaching Healthy Cultivation brand/education identity

Section ownership rules:

- `Courses`, education pages, and learning references belong beneath `Learn`.
- Diagnostic tools, GrowLens, THC Grow Doc, and related plant-diagnostic utilities belong beneath `Tools`.
- Product, cart, checkout, and account commerce flows belong beneath `Shop` for active-navigation purposes.
- Gallery, About, and Contact are secondary/company navigation rather than primary sections.

Do not restore the obsolete primary labels `Home`, `Seeds`, `Courses`, or `Diagnostic` into the six-link top-level row.

## Required header treatment

- Full-width dark green/near-black header.
- DTF Genetics brand block at left with `Dream the Future` supporting line; the brand links Home.
- Primary navigation uses the exact canonical row: Genetics, Learn, Tools, Games, Community, Shop.
- Learn receives the active state for `/learn/`, `/courses/`, `/education/`, and related learning routes.
- Tools receives the active state for `/tools/`, GrowLens, THC Grow Doc, and related diagnostic routes.
- Shop receives the active state for `/shop/`, product, cart, checkout, and account routes.
- Search, account, and cart remain compact utility actions rather than primary-navigation labels.
- `Teaching Healthy Cultivation` remains visible as the education identity when width permits.
- Thin green divider/accent at the lower header edge.
- Desktop header should feel clean, editorial, and premium rather than card-based.
- Use code-native text, links, icons, focus states, and responsive behavior. Do not ship the screenshot itself as the header UI.

## Responsive behavior

The labels and information architecture do not change by device. Only presentation changes.

### Desktop

- Keep all six primary destinations in one horizontal row when they fit comfortably.
- Keep Search, Account, Cart, and Teaching Healthy Cultivation grouped at the right.
- Do not allow navigation labels to wrap.

### Tablet / compact desktop

- Preserve the brand and utility icons.
- Collapse the six primary destinations behind the Menu control before the row becomes cramped.
- Expanded navigation may use a multi-column panel.
- Touch targets must be at least 44px high.

### Mobile

- Keep the DTF Genetics brand visible.
- Keep Search, Account, Cart, and Menu available in the header.
- The expanded menu must show all six canonical destinations with the same wording and order.
- Use two columns when practical and one column on very narrow screens.

## Canonical human-facing sitemap roots

```text
DTF Genetics (brand → Home)
├── Genetics
├── Learn
│   └── Courses and education
├── Tools
│   └── Diagnostic, GrowLens, THC Grow Doc
├── Games
├── Community
└── Shop
```

Deeper pages live beneath these roots, but every new public page should have one clear primary owner among these six sections so breadcrumbs, active navigation, responsive menus, and route auditing stay consistent.

## Fidelity rule

The approved concept remains the visual source of truth for proportions, dark palette, spacing rhythm, active-state treatment, brand hierarchy, and course-site continuity. The canonical six-section navigation above is the information-architecture source of truth. Production UI must remain semantic HTML/CSS and accessible.
