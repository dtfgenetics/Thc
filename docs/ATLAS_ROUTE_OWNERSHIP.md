# THC Living Plant Atlas route ownership

Production site: `https://dtfseeds.com`

The site currently has two useful Atlas surfaces. They are related, but they are not interchangeable and should not silently overwrite one another.

## `/atlas/` — 3D Plant Atlas

- Purpose: specimen-first interactive anatomy explorer.
- Current implementation: Plant Atlas V4 under `site/public-route-patch/atlas/` and the synchronized GrowLens Atlas source.
- Deployment owner: DTFSeeds Public Suite.
- Visitor promise: rotate, zoom, inspect anatomical regions, use system cards and deep labs, then move into deeper plant-science material.
- Release proof: Public Suite deployment must verify `/atlas/` and representative Atlas child routes after publication.

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
