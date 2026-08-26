# DTFSeeds Production Ownership

Updated: 2026-08-26

This document defines the single-writer rule for public DTFSeeds routes. A route must have one authoritative production writer. Generic publishers may link to a route they do not own, but must not replace its content.

## Route ownership

| Public surface | Authoritative writer/source | Notes |
|---|---|---|
| `/` / Home | Canonical WordPress publisher | Editorial/root presentation. |
| `/learn/` | Canonical WordPress + dedicated education publishers for child libraries | Root navigation is canonical WordPress; specialized child routes retain their own publishers. |
| `/community/` | Canonical WordPress publisher | Editorial/community root. |
| `/shop/` | Canonical WordPress commerce-presentation publisher | Storefront presentation only; transaction data remains protected. |
| `/gallery/` | Canonical WordPress publisher | Editorial/media presentation. |
| `/about/` | Canonical WordPress publisher | Editorial root. |
| `/contact/` | Canonical WordPress publisher | Editorial root. |
| `/seeds/` and `/seeds/*` | Dedicated genetics library publisher | Sole writer for genetics library and line pages. Generic WordPress and commerce-visual scripts must not rewrite these routes. |
| `/learn/encyclopedia/` and lesson routes | Dedicated encyclopedia publisher | Publication is controlled by the current production-batch manifest and fresh-visitor verification. |
| `/learn/infographics/` and infographic/topic routes | Dedicated infographic/education publisher | Only quality-gated finished infographic media belongs on infographic surfaces. |
| `/games/` and static game/application routes | Static public application suite | Not owned by WordPress page reconciliation. |
| WooCommerce product transaction fields | Protected WooCommerce system/workflows | Price, sale price, stock, SKU, slug, product images, shipping, tax, and order-sensitive data are not owned by editorial publishers. |

## Single-writer enforcement completed

The following production conflicts were removed from `main` on 2026-08-26:

- `scripts/apply-wordpress-public-content-rest.mjs` no longer includes `seeds` in the generic WordPress page set.
- `scripts/rebuild-wordpress-commerce-visuals.mjs` no longer fetches or writes `/seeds/`.
- `.github/workflows/wordpress-canonical-production.yml` no longer verifies the obsolete hard-coded Seeds presentation and explicitly delegates genetics verification to the dedicated genetics publisher.

Relevant commits:

- `47435777b4d82b057adad2008468ed24e3c6315e` — reserve Seeds routes for genetics publisher.
- `6a842e6ccd99e8f773302639277f88bfafc0da91` — stop commerce visuals from rewriting genetics routes.
- `4be8371f501f92ba0eae7352d631b13cf9a0d8d7` — make genetics publisher the sole Seeds-route owner in canonical production.

## Release rule

A production item is considered **LIVE VERIFIED** only after all applicable gates pass:

1. Source/content validation.
2. Asset and route validation.
3. Protected publisher success.
4. Fresh anonymous visitor verification.
5. Release-ledger update.

A successful source commit alone is not proof that public production is current.
