# DTF Game Portfolio Audit Output Template

Use this template when `dtf-game-portfolio-upgrade` is asked to audit several or all games.

## Portfolio snapshot

- Audit date:
- Scope source:
- Public game count:
- Development release candidates:
- Prototypes not promoted:
- Concept-only titles:
- Canonical/source-map drift found:
- Highest portfolio risk:
- Highest shared-system opportunity:

## Shared-system findings

| System | Games needing it | Current implementations | Recommended owner | Priority | Notes |
| --- | --- | --- | --- | --- | --- |
| QA/browser harness | | | | | |
| Replay/debug export | | | | | |
| Input/action mapping | | | | | |
| Audio/settings | | | | | |
| Accessibility prefs | | | | | |
| Asset/performance validator | | | | | |
| Content authoring/validation | | | | | |
| Player Passport/achievements | | | | | |
| Telemetry/balance | | | | | |
| Multiplayer primitives | | | | | |
| Live-route verifier | | | | | |

## Per-game audit

Repeat for every title.

### <Game title>

- **Public slug / route:**
- **Canonical repo/path:**
- **Runtime/engine:**
- **Portfolio class:**
- **Player fantasy:**
- **Primary verbs:**
- **Core loop:**
- **Current content scale:**
- **Progression/replay today:**
- **Multiplayer/social today:**
- **Documented open release gates:**
- **Source/registry drift:**

#### Quality score

| Dimension | Score 0-5 | Evidence |
| --- | ---: | --- |
| Gameplay clarity | | |
| Controls/input | | |
| Responsiveness/feel | | |
| Visual hierarchy | | |
| Art/animation | | |
| Sound/feedback | | |
| Content/replay | | |
| Accessibility/mobile | | |
| Performance | | |
| Production reliability | | |

#### Findings

- **P0:**
- **P1:**
- **P2:**
- **P3:**

#### Upgrade recommendation

- **Highest-value next upgrade:**
- **Why it adds player value:**
- **Secondary additions:**
- **Shared systems to adopt:**
- **Technology/tools:**
- **Avoid for now:**
- **Evidence confidence:** CONFIRMED / OBSERVED / DOCUMENTED-OPEN / INFERRED / EXPERIMENTAL

#### Implementation handoff

- Canonical files likely affected:
- Tests/validators to run:
- Browser/mobile scenarios to verify:
- Release workflow/live verifier:
- Definition of done for this upgrade:

## Portfolio priority table

| Rank | Game/system | Work item | Severity | Player value | Release leverage | Reuse leverage | Cost/risk | Reason |
| ---: | --- | --- | --- | --- | --- | --- | --- | --- |
| 1 | | | | | | | | |

## Recommended execution waves

### Wave 1 — blockers and source integrity

List ownership drift, P0/P1 issues, broken multiplayer/release gates, and near-finished release candidates.

### Wave 2 — shared infrastructure

List reusable QA/debug/settings/content/asset systems that several games can adopt immediately.

### Wave 3 — flagship depth

List high-value gameplay/progression/content upgrades for the strongest games.

### Wave 4 — vertical-slice expansion

List thin but functional games that need content scale, replayability, final art/audio, and browser/mobile release work.

### Wave 5 — concept promotion

Only include concept-bank games whose mechanics, ownership, and differentiation are now strong enough to justify canonical development.

## Completion evidence

For work actually implemented from the audit, report each game separately as:

- SOURCE VALIDATED
- SUITE VALIDATED
- DEPLOYED
- LIVE ROUTE VERIFIED
- BROWSER PLAYTESTED

Never infer a higher evidence level from a lower one.