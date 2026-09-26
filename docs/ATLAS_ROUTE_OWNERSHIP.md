# THC Living Plant Atlas route ownership

Production site: `https://dtfseeds.com`

The site currently has two useful Atlas surfaces. They are related, but they are not interchangeable and should not silently overwrite one another.

## `/atlas/` — 3D Plant Atlas

- Purpose: specimen-first interactive anatomy explorer.
- Current implementation: Plant Atlas V4 under `site/public-route-patch/atlas/` and the synchronized GrowLens Atlas source.
- Deployment owner: the independent `plant-atlas` production resource, coordinated by the DTFSeeds resource gateway.
- Visitor promise: rotate, zoom, inspect anatomical regions, use system cards and deep labs, then move into deeper plant-science material.
- Release proof: the Plant Atlas resource deployment must verify `/atlas/`, its visitor-contract markers and representative Atlas child routes after publication. The Public Suite archive must exclude both `atlas/` and the duplicate `growlens/atlas/` payload.

This is the canonical route for navigation labels such as **3D Plant Atlas** and **THC Living Plant Atlas — 3D Explorer**.

## `/learn/atlas/` — Atlas Learning Library

- Purpose: lesson-first education surface with the established 10-system / 100-lesson learning structure, evidence, diagnostics, practice and deeper educational navigation.
- Ownership: Learning/WordPress plus the established Dtf420 child-route overlay and its acceptance checks.
- Visitor promise: go deeper after anatomy exploration through structured lessons and evidence-backed learning.
- Existing child routes under `/learn/atlas/...` remain supported unless they are deliberately migrated with redirects and release verification.

This route should be labeled **Atlas Learning Library** when it appears beside `/atlas/`, so visitors can understand the difference.

## Rules

1. Do not redirect or delete either surface merely to make the route names match.
2. `/atlas/` remains the canonical V4 3D specimen route.
3. `/learn/atlas/` remains the canonical lesson-library namespace until a separately reviewed migration retires it.
4. Public navigation should expose both surfaces from Learn with distinct labels.
5. A deployment or verifier must not call `/learn/atlas/` the canonical V4 route or call `/atlas/` the 100-lesson library route.
6. Any future consolidation must include a child-route migration map, redirects, link updates, search/index updates, and production smoke verification before the old namespace is retired.

## `/terpene-atlas/` — Terpene Atlas

- Purpose: chemistry-first interactive terpene and terpenoid knowledge explorer.
- Ownership: Learn.
- Visitor promise: search compounds, compare chemistry/families/aliases, inspect source-backed Cannabis occurrence, and keep quantitative cultivar information tied to measured samples rather than strain-name assumptions.
- Relationship to Plant Atlas: cross-link directly with `/atlas/trichomes-resin/` and flower/reproductive modules so secretory anatomy and volatile chemistry remain connected.
- Release rule: source and public-route mirrors, ontology data, sample schema, explorer runtime, and route navigation must validate together.

This route should be labeled **Terpene Atlas** or **THC Terpene Atlas — Chemistry Explorer** depending on navigation context.
