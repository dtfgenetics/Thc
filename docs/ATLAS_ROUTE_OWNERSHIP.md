# THC Living Plant Atlas route ownership

Production site: `https://dtfseeds.com`

The site has two related Atlas surfaces. They are not interchangeable and should not silently overwrite one another.

## `/atlas/` — 3D Plant Atlas

- Purpose: specimen-first interactive anatomy explorer.
- Canonical implementation: `dtfgenetics/Tools/site/public-route-patch/atlas/`.
- THC integration mirror: `site/public-route-patch/atlas/`.
- Deployment owner: DTFSeeds Public Suite in `dtfgenetics/Thc`.
- Visitor promise: rotate, zoom, inspect anatomical regions, use system cards and deep labs, then move into deeper plant-science material.
- Release proof: the public-suite deployment must verify `/atlas/` and representative Atlas child routes after publication.

This is the canonical route for navigation labels such as **3D Plant Atlas** and **THC Living Plant Atlas — 3D Explorer**.

## `/learn/atlas/` — Atlas Learning Library

- Purpose: lesson-first education surface with the established structured learning system, evidence, diagnostics, practice and deeper educational navigation.
- Ownership: Learning/WordPress plus the established Dtf420 child-route overlay and its acceptance checks.
- Visitor promise: go deeper after anatomy exploration through structured lessons and evidence-backed learning.
- Existing child routes under `/learn/atlas/...` remain supported unless they are deliberately migrated with redirects and release verification.

This route should be labeled **Atlas Learning Library** when it appears beside `/atlas/`.

## Rules

1. Do not redirect or delete either surface merely to make the route names match.
2. `/atlas/` remains the canonical V4 3D specimen route.
3. `/learn/atlas/` remains the canonical lesson-library namespace until a separately reviewed migration retires it.
4. Public navigation should expose both surfaces from Learn with distinct labels.
5. A deployment or verifier must not call `/learn/atlas/` the canonical V4 route or call `/atlas/` the lesson library route.
6. Tool/Atlas implementation changes originate in `dtfgenetics/Tools`; `dtfgenetics/Thc` must not recreate a second authoring source under GrowLens.
7. Any future consolidation must include a child-route migration map, redirects, link updates, search/index updates, and production smoke verification before an old namespace is retired.

## `/terpene-atlas/` — Terpene Atlas

- Purpose: chemistry-first interactive terpene and terpenoid knowledge explorer.
- Canonical implementation: `dtfgenetics/Tools/site/public-route-patch/terpene-atlas/`.
- THC integration mirror: `site/public-route-patch/terpene-atlas/`.
- Visitor promise: search compounds, compare chemistry/families/aliases, inspect source-backed Cannabis occurrence, and keep quantitative cultivar information tied to measured samples rather than strain-name assumptions.
- Relationship to Plant Atlas: cross-link directly with `/atlas/trichomes-resin/` and flower/reproductive modules so secretory anatomy and volatile chemistry remain connected.
- Release rule: canonical Tools validation must be green; the THC deployment mirror and route navigation must then pass integration and live verification.

This route should be labeled **Terpene Atlas** or **THC Terpene Atlas — Chemistry Explorer** depending on navigation context.
