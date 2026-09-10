# Development Debugging Reference

Use this reference to diagnose, reproduce, repair, and verify source, runtime, route, API, deployment, asset, accessibility, performance, and visual defects in DTF Seeds repositories and the deployed web experience.

## Required QA policy
Routine QA is deterministic and lightweight. Prefer Node-based tests, static/package validation, build checks, API and persistence tests, HTTP/HTML route checks, asset validation, approved-reference image inspection, and Lighthouse. Do not add Playwright or another browser automation framework to routine development, repository dependencies, project skills, or CI.

## Core debugging loop
1. Identify the exact failing commit, route, component, API, game, page, asset, or deployment.
2. Reproduce with the smallest deterministic test practical.
3. Capture concrete evidence: error text, stack trace, HTTP response, failed asset, test output, screenshot/reference mismatch, or Lighthouse audit.
4. Classify the root cause before editing.
5. Repair the causal layer rather than suppressing the symptom.
6. Add the smallest stable regression test that would have caught the defect.
7. Run the narrow test, then the wider relevant suite.
8. For web-facing work, run route/asset health checks and Lighthouse; perform visual-reference review when appearance changed.
9. Push only coherent fixes through the normal branch/PR flow.
10. Verify the newest SHA and production state when affected.

## Failure classes
Classify defects as one or more of: syntax/type/module/build; dependency/runtime mismatch; route/navigation/broken link; rendering/hydration/state/interaction; API/data-shape/auth/session; persistence/database; responsive/layout/overflow; visual asset/font/image; accessibility; performance/Core Web Vitals; SEO/metadata/crawlability; failed first-party request; caching/CDN/environment mismatch; production-vs-source drift; flaky dependency/test.

## Site-wide deterministic route audit
For `https://dtfseeds.com`, build the route inventory from sitemap data, repository routes, server-returned internal links, navigation/footer links, game/tool/content registries, canonical URLs, and intentional redirects.

Use `scripts/discover-public-routes.mjs` followed by `scripts/check-public-route-health.mjs`.

The deterministic health pass should detect failed navigation/status responses, non-HTML responses where HTML is expected, implausibly thin server output, missing main/H1 semantics, failed first-party image/script/style assets, and accidental public 4xx/5xx routes. Do not call a page healthy merely because the top-level request returned HTTP 200.

## Production verification
When a defect is reported on production, confirm the symptom, identify the repository source expected to own it, distinguish source/deployment/cache/environment/routing causes, validate the repair, promote through repository lifecycle, rerun production checks, and confirm the deployed version contains the intended fix. A merged commit is not proof production changed.
