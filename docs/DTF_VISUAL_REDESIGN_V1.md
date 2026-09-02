# DTF Visual Redesign V1

Status: accepted design direction, implementation branch `visual-redesign-v1`.

## Direction

DTFSeeds.com is being unified around a premium botanical-science, genetics-laboratory, and independent-game-studio visual language. The shared system uses a near-black botanical green foundation, restrained gold borders and accents, moss-green primary actions, condensed uppercase display typography, neutral sans-serif body copy, high-detail genetics imagery, scientific education visuals, and dedicated game key art.

## Single-writer rollout

The redesign follows the existing production ownership map rather than introducing a generic site-wide writer.

- Home + Learn: Learning Experience V3 remains authoritative. `scripts/apply-learning-visual-v1.mjs` is the final presentation pass inside `scripts/run-learning-v3-connected-production.sh`.
- Genetics: the dedicated genetics publisher remains authoritative. `scripts/apply-wordpress-genetics-visual-v1.mjs` runs after reviewed genetics content/media publication and before cache acceptance.
- Shop/WooCommerce: the commerce presentation lane remains authoritative. `scripts/apply-wordpress-shop-visual-v1.mjs` runs from the commerce rebuild and changes presentation only; WooCommerce transaction fields are not written.
- Games: the static public application suite remains authoritative. `site/public-route-patch/games/dtf-route.css` owns shared wrapper styling while individual game runtimes remain isolated.
- Community, Gallery, About, Contact: the canonical WordPress publisher injects the shared visual system into these editorial pages.

## Shared assets

- `site/design-system/dtf-visual-v1.css`
- `site/design-system/dtf-learning-owner-v1.css`
- `site/design-system/dtf-genetics-owner-v1.css`
- `site/design-system/dtf-shop-owner-v1.css`
- `data/dtf-visual-v1.json`

## Safety contracts

- Preserve canonical navigation: Genetics / Learn / Tools / Games / Community / Shop.
- Preserve at least 44px interactive hit targets.
- Do not alter game engine/runtime logic while styling public wrappers.
- Do not alter WooCommerce price, stock, SKU, tax, shipping, checkout, or order data from visual code.
- Preserve route-owner verification markers and rollback evidence.
- Promotion to `main` requires CI and visitor-facing verification after production deployment.
