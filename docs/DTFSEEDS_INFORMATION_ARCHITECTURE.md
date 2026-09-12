# DTFSeeds Information Architecture

Updated: 2026-09-12

Status: canonical visitor-facing structure for `https://dtfseeds.com`

This document defines how DTFSeeds content is arranged for visitors. It complements `docs/DTFSEEDS_PRODUCTION_OWNERSHIP.md`, which defines who may write each production route, and `data/site-registry.json`, which is the machine-readable route/deployment control map.

## Core rule

Every public page must answer two questions:

1. Which visitor-facing root does this page belong under?
2. Which single production writer owns the route?

A page may be linked from several places, but it has one primary information-architecture root and one authoritative production writer. Shared header/footer styling may span the entire platform without taking ownership of page content.

## Canonical primary navigation

The primary navigation is locked in this order:

1. Home — `/`
2. Seeds — `/seeds/`
3. Learn — `/learn/`
4. Courses — `/courses/`
5. Diagnostic — `/tools/`
6. Games — `/games/`
7. Community — `/community/`
8. Shop — `/shop/`

Do not rename Seeds to Genetics in the primary navigation. Do not rename Diagnostic to Tools in the primary navigation. Do not merge Courses into Learn. Search, Account, Cart, About, Contact, Gallery, and direct action buttons remain outside the primary navigation.

## Root responsibilities

### Home

Purpose: orientation, not a warehouse for every feature.

Home should explain what DTF Genetics is, surface the strongest current destinations, and route visitors toward Seeds, Learn, Courses, Diagnostic, Games, Community, or Shop. Detailed reference material belongs deeper in the site.

### Seeds

Purpose: genetics and breeding information.

Belongs here: genetics library entries, breeding lines, lineage, generation records, phenotype/selection context tied to DTF genetics, release information, and paths into current seed products.

Does not belong here: general cultivation lessons, course tests, diagnostics, games, or generic company pages.

### Learn

Purpose: free topic-first reference learning.

Belongs here: plant science, cultivation science, plant health, symptom differentials, encyclopedia pages, infographics, beginner guides, SOP/reference material, measurement references, glossary, sources, printables, records, and the Atlas learning library.

A visitor should be able to open Learn with a question and reach the relevant reference without being forced into a course sequence.

### Courses

Purpose: sequenced instruction.

Belongs here: curriculum pathways, modules, lessons, workbooks, practice, practicals, module tests, final course assessments, progress, and certification-oriented learning pathways.

Existing Learning Hub course URLs below `/learn/learning-hub/` remain stable. Their visitor-facing parent is Courses even though their historical URL contains `/learn/`.

Course tests are learning assessments. Professional certification governance and secure certification examinations remain a distinct credential layer.

### Diagnostic

Purpose: record, measure, diagnose, and verify.

Belongs here: GrowLens, THC Grow Doc, diagnostic workflows, calculators, charts, measurement tools, nutrient/pH references used as decision support, and related evidence-oriented utilities.

The visitor-facing label is Diagnostic while the root URL remains `/tools/`.

### Games

Purpose: playable experiences.

Belongs here: the game hub, individual browser games, multiplayer games, development-status presentation when intentionally public, and links to each canonical game runtime.

Each game remains owned by its canonical repository/runtime; the hub does not become the source of truth for game code.

### Community

Purpose: participation.

Belongs here: Discord entry, grow-offs, events, community standards, community projects, participation guidance, and gallery/community pathways.

### Shop

Purpose: commerce.

Belongs here: storefront presentation, product discovery, cart/account entry points, and protected WooCommerce purchase flows. Editorial publishers must not overwrite protected price, stock, SKU, shipping, tax, order, or checkout data.

## Company and support routes

`/gallery/`, `/about/`, and `/contact/` are valid public pages but are not primary-navigation peers. They belong in footer/support navigation and contextual links.

Account, Cart, Search, and other utility actions are also separate from the eight primary destinations.

## Special route cases

`/atlas/` is the interactive 3D Plant Atlas and belongs primarily to Learn. `/learn/atlas/` is the Atlas Learning Library. These are related but intentionally distinct surfaces and must not overwrite or redirect into one another.

`/learn/learning-hub/` and its course descendants belong to the Courses visitor journey. Keep the established URLs stable unless an explicit migration with redirects is approved.

`/growlens/` and `/thc-grow-doc/` belong beneath Diagnostic even though they are standalone application routes.

Individual WooCommerce product routes belong beneath Shop from a visitor-information perspective while their transactional data remains protected by WooCommerce ownership rules.

## Landing-page pattern

Each of the eight roots should follow a predictable information hierarchy:

1. Clear purpose/hero.
2. Recommended starting point or primary task.
3. Categories or pathways.
4. Complete content/tool/game/product collection as appropriate.
5. Contextual related destinations.
6. Breadcrumb or location context on deeper pages.

This pattern should be adapted to the content type rather than forcing identical card layouts onto every page.

## Content reconciliation statuses

During the sitewide content inventory, assign every discovered public route one of these dispositions:

- `KEEP` — correct route, correct owner, useful current content.
- `MOVE` — useful content is under the wrong visitor-facing root or source location.
- `MERGE` — duplicates or substantially overlaps a stronger canonical page; preserve unique useful material in the canonical page.
- `REDIRECT` — obsolete route should resolve permanently to a canonical replacement after content has been preserved.
- `ARCHIVE` — historical/internal material should no longer be part of normal public navigation.
- `FIX` — correct conceptual location but broken, incomplete, inaccessible, visually inconsistent, or technically unhealthy.

Never delete a duplicate page before useful unique material is reconciled and the redirect/canonical plan is recorded.

## Arrangement rules

- One subject should have one obvious canonical landing point.
- Learn is reference-first; Courses is sequence-first.
- Diagnostic is task/evidence-first; educational background may link back to Learn rather than being duplicated.
- Seeds contains DTF genetics-specific knowledge; broad plant science belongs in Learn.
- Games remain isolated from educational and commerce ownership even when they teach cannabis concepts.
- Support/company pages do not compete with primary product and learning destinations.
- A public page should be reachable through at least one deliberate navigation path, sitemap path, contextual link, or search surface unless it is intentionally archived/private.
- Breadcrumbs and active navigation should use the page's primary root, including special cases such as Learning Hub course URLs appearing under Courses.

## Enforcement

Machine-readable structure lives in:

- `data/public-navigation.json` — visitor-facing navigation, section groupings, quick actions, and information-architecture roots.
- `data/site-registry.json` — site/deployment map and route-family ownership context.
- `docs/DTFSEEDS_PRODUCTION_OWNERSHIP.md` — single-writer production rules.

Validation must fail when the eight primary destinations drift in label, order, or destination; when the public-navigation registry and site registry disagree; or when a route owner violates the production ownership contract.

The deterministic sitewide crawler then verifies the public result for broken routes, shell drift, missing accessibility structure, and asset failures. A source commit is not proof that production is current; live anonymous verification remains required.
