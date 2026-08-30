# DTFSeeds Production Ownership

Updated: 2026-08-30

This document defines the single-writer rule for public DTFSeeds routes. A route must have one authoritative production writer. Generic publishers may link to a route they do not own, but must not replace its content.

## Route ownership

| Public surface | Authoritative writer/source | Notes |
|---|---|---|
| `/` / Home | Learning Experience V3 with reusable final Home visual handoff | The broad canonical WordPress lane preserves the stored Home content and may verify it read-only; Learning V3 owns automatic Home publication. |
| `/learn/` | Learning Experience V3 | Sole automatic Learn-root writer. Education publishers may publish child libraries but must never append, replace, or otherwise mutate the Learn root. |
| `/community/` | Canonical WordPress publisher | Editorial/community root. |
| `/shop/` | Canonical WordPress commerce-presentation publisher | Storefront presentation only; transaction data remains protected. |
| `/gallery/` | Canonical WordPress publisher | Editorial/media presentation. |
| `/about/` | Canonical WordPress publisher | Editorial root. |
| `/contact/` | Canonical WordPress publisher | Editorial root. |
| `/seeds/` and `/seeds/*` | Dedicated genetics library publisher | Sole writer for genetics library and line pages. Generic WordPress and commerce-visual scripts must not rewrite these routes. |
| `/learn/plant-health/`, `/learn/cultivation-science/`, `/learn/symptoms/`, `/learn/tools/`, `/learn/sources/` | THC education expansion publisher | Child pages are source-controlled education surfaces. Their links into `/learn/` are published by Learning Experience V3, not by the child-page publisher. |
| `/learn/encyclopedia/` and lesson routes | Dedicated encyclopedia publisher | Publication is controlled by the current production-batch manifest and fresh-visitor verification. |
| `/learn/infographics/` and infographic/topic routes | Dedicated infographic/education publisher | Only quality-gated finished infographic media belongs on infographic surfaces. |
| `/games/` and static game/application routes | Static public application suite | Not owned by WordPress page reconciliation. |
| WooCommerce product transaction fields | Protected WooCommerce system/workflows | Price, sale price, stock, SKU, slug, product images, shipping, tax, and order-sensitive data are not owned by editorial publishers. |

## Single-writer enforcement completed

The following production conflicts have been removed from `main`:

- `scripts/apply-wordpress-public-content-rest.mjs` no longer includes `seeds` in the generic WordPress page set.
- `scripts/rebuild-wordpress-commerce-visuals.mjs` no longer fetches or writes `/seeds/`.
- `.github/workflows/wordpress-canonical-production.yml` no longer verifies the obsolete hard-coded Seeds presentation and explicitly delegates genetics verification to the dedicated genetics publisher.
- The canonical WordPress production workflow uses an ownership-preserving wrapper so it cannot replace Home or Learn content while reconciling the rest of the editorial surface.
- `scripts/update-wordpress-learn-expansion-v1.mjs` is a read-only convergence check; it cannot mutate `/learn/`.
- `scripts/run-learning-v3-connected-production.sh` publishes the connected Learning V4 map and the expanded THC reference links as part of the same Learning V3 owner transaction.

Relevant historical commits:

- `47435777b4d82b057adad2008468ed24e3c6315e` — reserve Seeds routes for genetics publisher.
- `6a842e6ccd99e8f773302639277f88bfafc0da91` — stop commerce visuals from rewriting genetics routes.
- `4be8371f501f92ba0eae7352d631b13cf9a0d8d7` — make genetics publisher the sole Seeds-route owner in canonical production.
- `71a145ff27ad89cf912adbe3c13e6315747b2bd1` — make Learning Experience V3 the serialized Learn owner.

Together these changes keep the genetics publisher the sole Seeds-route owner and Learning Experience V3 the sole automatic Learn-root owner.

## Release rule

A production item is considered **LIVE VERIFIED** only after all applicable gates pass:

1. Source/content validation.
2. Asset and route validation.
3. Protected publisher success.
4. Fresh anonymous visitor verification.
5. Release-ledger update.

A successful source commit alone is not proof that public production is current.
