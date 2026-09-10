---
name: dtf-web-quality-gate
description: Audit and verify DTFSeeds web pages, games, tools, educational routes, and interactive features for browser correctness, visual quality, responsive behavior, accessibility, performance, broken resources, and live parity. Use for Lighthouse, browser/UI validation, pixel/visual regression, mobile QA, broken links/images, console/runtime errors, or release-readiness checks across dtfseeds.com.
compatibility: Browser-capable agent environment with Lighthouse or equivalent web performance tooling, direct browser inspection, screenshot/image comparison, and deterministic unit/integration test support.
metadata:
  author: dtfgenetics
  version: "1.2.0"
---

# DTF Web Quality Gate

This is the common visitor-facing quality gate for the DTF web portfolio. It applies to site pages, educational routes, games, Plant Atlas, Grow Doc, calculators, libraries, and embedded/public-route applications.

Detailed guidance migrated out of the certification repository is preserved here:

- `references/development-debugging.md` — root-cause web/runtime/route debugging and deterministic production verification.
- `references/pixel-perfect-visual-qa.md` — approved-reference visual fidelity and responsive QA.
- `references/lighthouse-site-auditor.md` — site-wide Lighthouse inventory, scoring, and regression policy.

The canonical deterministic site-wide tooling lives in this production repository at:

- `web-qa.config.mjs`
- `scripts/discover-public-routes.mjs`
- `scripts/check-public-route-health.mjs`
- `lighthouserc.cjs`
- `.github/workflows/web-quality.yml`

## Non-negotiable tooling rule

Do not use Playwright in this skill or as an automatic fallback in any action. Browser validation must use direct browser inspection, deterministic application tests, HTTP/resource checks, Lighthouse or equivalent auditing, screenshot/image comparison, and targeted manual/agent interaction checks appropriate to the route.

## Required gate layers

Run the narrow changed-route checks first, then the release-scope crawl.

1. **Runtime:** HTTP success, no fatal console/page errors, required assets load, primary interaction works.
2. **Responsive:** desktop, tablet/compact, and mobile viewport coverage; no clipped controls, overlays, pointer interception, or unusable horizontal overflow.
3. **Interaction:** keyboard, mouse/pointer, and touch where applicable; visible focus; minimum practical touch targets; deterministic critical-flow assertions using application-level or integration tests rather than Playwright.
4. **Visual:** stable screenshots at defined checkpoints, layout hierarchy, spacing, typography, image crop/quality, broken placeholders, modal/overlay stacking, and game HUD readability.
5. **Accessibility:** semantic headings/landmarks, labels/names, contrast, focus order, keyboard reachability, reduced-motion behavior, forced-colors/high-contrast resilience where supported.
6. **Performance:** Lighthouse/performance budget by route class, excessive JS/assets, layout shift, image sizing, blocking resources, and slow interaction readiness.
7. **Content integrity:** broken links, missing images/downloads, stale route references, canonical/meta/description requirements where applicable.
8. **Live parity:** after deployment, repeat the critical path against the visitor-facing URL and record the deployed release/commit evidence.

## Route classes

Use different acceptance profiles rather than one misleading score target:

- static/content/education page;
- interactive educational tool;
- 2D game;
- 3D/WebGL game or Plant Atlas;
- account/networked/multiplayer runtime;
- download/resource library.

A 3D route may have a different Lighthouse performance budget from a text lesson, but it still must be responsive, accessible around the canvas, free of fatal errors, and usable on its supported devices.

## Visual regression contract

For every critical route keep deterministic checkpoints for:

- initial/hero state;
- primary interaction state;
- modal/inspector/results state when present;
- compact/mobile state;
- error/empty/loading state when the feature has one.

Do not approve a visual change solely because pixels differ less. Inspect whether the new image actually matches the product goal and does not hide a semantic/runtime failure.

## Browser/UI failure taxonomy

Classify before patching:

- stale test or assertion drift;
- real DOM regression;
- pointer interception/z-index;
- responsive clipping/overflow;
- animation/timing instability;
- network/data dependency;
- route/bootstrap failure;
- canvas/WebGL state mismatch;
- accessibility contract failure;
- screenshot-only visual drift.

Repair product bugs in product code. Repair stale tests only when the intended product behavior is confirmed. Prefer deterministic unit/integration coverage and direct browser verification over brittle browser automation.

## Lighthouse contract

For every release-scope route, capture performance, accessibility, best-practices, and SEO where meaningful. Store the exact URL, run timestamp, release SHA/version, device profile, and major failing audits. Do not chase a cosmetic 100 score by removing required product capability; fix root causes and use route-class budgets.

## Release rule

A repository-green PR is not web-quality complete until its changed visitor-facing routes pass the applicable browser/visual/accessibility/performance profile. Production completion additionally requires live-route verification after deployment.

## Handoff

- Code/runtime defects → `github-repo-manager` or subsystem skill.
- Game playability defects → `dtf-game-production` / `dtf-game-portfolio-upgrade`.
- Deployment/live drift → `dtfseeds-production-publishing` / `dtfseeds-production-repair`.
- Cross-project prioritization → `dtf-system-orchestrator`.
