# Lighthouse Site Auditor Reference

Use Lighthouse and Lighthouse CI to continuously measure and improve discoverable public pages on `https://dtfseeds.com`.

Primary quality target: 100 Performance, 100 Accessibility, 100 Best Practices, and 100 SEO where the route class makes those categories meaningful. Results must remain truthful; never suppress a valid audit or misreport a score to obtain 100.

## Route inventory
Before Lighthouse runs, build the page inventory from XML sitemaps, repository route definitions, first-party internal links, navigation/footer links, game/tool/content registries, canonical URLs, and known public landing pages.

Use `scripts/discover-public-routes.mjs` as route discovery and `scripts/check-public-route-health.mjs` for deterministic HTTP/HTML and asset validation. Normalize same-origin URLs, remove fragments, deduplicate trailing-slash equivalents, avoid destructive/account-mutation URLs, and prevent query/pagination explosions.

## Required Lighthouse categories
Collect and inspect Performance, Accessibility, Best Practices, and SEO. Inspect underlying diagnostics rather than relying only on category numbers.

## 100-score policy
For each deduction: identify the exact failing audits, separate first-party causes from third-party/environment causes, repair deterministic first-party causes, rerun the affected page, rerun the representative/full route set after shared changes, and document remaining external limitations with evidence.

Never disable a valid audit, remove required functionality to manipulate a score, claim 100 without report evidence, or accept a new regression because a page remains merely “high enough.”

## Priority order
1. Broken functionality, failed requests, and missing assets.
2. Accessibility blockers.
3. Security and Best Practices failures.
4. Severe performance/Core Web Vitals risks.
5. SEO/crawlability issues.
6. Remaining deterministic deductions.
7. Documented third-party/environment limitations.

## Lighthouse CI
Produce the URL manifest, run Lighthouse CI over controlled route batches, retain reports as artifacts, summarize routes below target, block unexplained material regressions according to release policy, and rerun production verification after deployment. Chrome may be installed for Lighthouse itself; do not add Playwright or another browser automation framework as a Lighthouse dependency.

## Completion standard
Every normalized public route must be accounted for, every auditable route must have a current result, scores and failures must be reported truthfully, deterministic first-party defects must be repaired or tracked, no unexplained regression may remain, and production must be re-audited after production-affecting releases.
