# DTF Game Profile Standard

## Purpose

DTF games intentionally use different engines, interaction models, session lengths, persistence strategies, network models, content systems, and security requirements. The platform standardizes contracts and release evidence without forcing every game into one runtime or one QA checklist.

Canonical sources:

- `data/game-registry-v2.json` — identity, ownership, architecture, verification, and release state.
- `configuration/game-qa/game-profiles.json` — capability-driven quality profiles and required checks.
- `npm run games:resolve -- <game>` — combined operator/agent view.
- `npm run games:profiles:check` — profile coverage and compatibility validation.
- `npm run games:profiles:strict` — compliance-debt audit for production hardening.
- `npm run games:consistency` — portfolio-level ownership/release/profile reconciliation.

## Profile dimensions

Every registered game must declare all nine dimensions:

1. gameplay profile
2. renderer profile
3. session profile
4. persistence profile
5. network profile
6. content profile
7. performance profile
8. security profile
9. accessibility profile

The dimensions are independent. A game can therefore be a campaign RPG rendered in Three.js with a long session, campaign saves, local networking, branching narrative content, a 3D performance budget, persistent-solo security, and a 3D accessibility contract.

## Release rule

A game is not production-ready merely because it builds.

Release evidence is the union of:

`core checks + gameplay-profile checks + declared capability checks + release-stage checks`.

Do not require irrelevant checks. A local crossword does not need WebSocket authority tests. A realtime multiplayer game does. A Three.js game receives GPU/3D performance expectations that a DOM trivia game does not.

## External references

The profile catalog records the external standards used to shape these rules.

- Poki quality requirements: https://developers.poki.com/guide/requirements-quality
  - desktop/mobile/tablet behavior
  - safe storage fallback
  - gameplay lifecycle signaling
  - streamlined entry
  - adaptive controls
  - small/clean builds
- CrazyGames technical requirements: https://docs.crazygames.com/requirements/technical/
  - initial download size
  - time-to-gameplay measurement
  - mobile/touch requirements
  - device/performance constraints
- OWASP WebSocket Security Cheat Sheet: https://cheatsheetseries.owasp.org/cheatsheets/WebSocket_Security_Cheat_Sheet.html
  - origin validation
  - per-message authorization
  - schema/input validation
  - payload limits
  - rate limiting
  - heartbeat/idle cleanup
  - backpressure and security monitoring
- MDN PWA installability: https://developer.mozilla.org/en-US/docs/Web/Progressive_web_apps/Guides/Making_PWAs_installable
  - explicit installability/manifest decisions
  - offline behavior as progressive enhancement
- MDN Page Visibility API: https://developer.mozilla.org/en-US/docs/Web/API/Page_Visibility_API
  - interruption handling and user-intent-preserving resume behavior
- OpenFeature: https://openfeature.dev/docs/reference/intro/
  - provider-neutral feature flags, maintenance mode, staged rollout, and kill switches
- OpenTelemetry JavaScript: https://opentelemetry.io/docs/languages/js/
  - server-side traces and metrics for networked game operations

These references inform the DTF standard; DTF games are not required to use any specific third-party publishing platform.

## Agent/developer workflow

Before changing a game:

1. Resolve the canonical game with `npm run games:resolve -- <name-or-alias>`.
2. Confirm canonical repository/source and current release status.
3. Read the returned profile and required checks.
4. Inspect the canonical source.
5. Make the smallest change in the canonical owner.
6. Run the game-specific verification plus `npm run games:profiles:check`.
7. For release work, also run strict profile compliance and the relevant production/live checks.

Never infer requirements solely from genre labels. Use the machine-readable profile.

## Compliance debt

Strict profile warnings are intentional work items, not permission to invent metadata. If a profile requires versioned persistence but the registry lacks a save version, inspect the canonical implementation and either:

- record the existing real save version;
- add a real version/migration contract; or
- correct the persistence profile if the game does not actually promise durable recovery.

Do not assign fake save versions solely to satisfy validation.

`data/game-profile-compliance.json` is generated from the registry and profile catalog. Keep it current with `npm run games:profiles:report`; CI verifies freshness with `npm run games:profiles:report-check`. Use `npm run games:profiles:strict -- --id <game-id>` for a release-scoped compliance gate.
