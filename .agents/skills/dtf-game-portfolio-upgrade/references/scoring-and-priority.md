# DTF Game Portfolio Scoring and Priority Rubric

Use this reference with `dtf-game-portfolio-upgrade`.

## Score meanings

Apply the same 0-5 meaning to every quality dimension.

- **0 — Missing/broken:** capability is absent or prevents meaningful play.
- **1 — Major deficiency:** exists only in a fragile, placeholder, or frequently failing form.
- **2 — Partial:** usable in limited circumstances but has obvious player-facing gaps or unclosed release gates.
- **3 — Functional:** core behavior works, but quality/depth/evidence is not yet strong enough to call mature.
- **4 — Strong:** solid player-facing implementation with appropriate automated/browser evidence and only non-blocking gaps.
- **5 — Excellent:** polished, tested, scalable, accessible, performant, and demonstrably production-reliable for the title's scope.

A score is evidence-based, not aspirational. If no browser/mobile/performance evidence exists, do not infer a 5 from source quality alone.

## Ten dimensions

### 1. Gameplay clarity

Ask whether a first-time player understands the goal, legal actions, state changes, success, and failure without developer knowledge.

### 2. Controls/input quality

Check keyboard, pointer, touch, controller where relevant, input locking, modal conflicts, accidental double actions, and remappable/action-mapped boundaries where appropriate.

### 3. Responsiveness/feel

Check latency, animation timing, movement/turn feedback, transition timing, hit/action confirmation, and whether the game feels immediate rather than mechanically correct but lifeless.

### 4. Visual hierarchy/readability

Check focal point, board/playfield visibility, text size, contrast, state distinction, mobile layout, and whether HUD chrome obscures gameplay.

### 5. Art/animation quality

Check final vs placeholder art, consistency, readability of sprites/cards/board pieces, animation quality, asset integrity, and whether production visuals support the game fantasy.

### 6. Sound/feedback quality

Check useful SFX, music/ambience where appropriate, mute/volume controls, browser autoplay compliance, haptics where useful, and whether important actions have sufficient multimodal feedback.

### 7. Content completeness/replay value

Check content scale, variety, balance, progression, daily/challenge systems, branching, collection, mastery, social variance, and whether repeat runs remain interesting.

### 8. Accessibility/mobile usability

Check semantic controls, focus states, no color-only meaning, reduced motion, phone-width usability, touch-target size, safe areas, screen-reader support where relevant, and accessible alternatives for highly visual puzzles.

### 9. Performance/runtime health

Check initial payload, biggest assets, FPS/frame-time, memory/timer/listener growth, loading behavior, WebGL fallback where relevant, and target-device performance.

### 10. Production reliability/release evidence

Check canonical ownership, deterministic tests, build, browser tests, public-suite integration, deployment, live-route verifier, rollback/recovery, save migrations, and known registry/source drift.

## Severity mapping

- **P0:** crash, inaccessible route, data loss, security/privacy issue, impossible start/finish.
- **P1:** broken input, severe mobile failure, soft-lock, critical missing asset, unusable multiplayer, severe performance.
- **P2:** confusing UX, weak feedback, partial accessibility, visual inconsistency, shallow but functional content.
- **P3:** optional polish and nonessential expansion.

Zero known P0/P1 issues is required before calling a game production-ready.

## Portfolio priority score

Use qualitative judgment first. When ranking many comparable tasks, this optional score can help:

```text
priority =
  blocker_impact
+ player_value
+ release_proximity
+ reuse_leverage
+ confidence
- implementation_cost
- migration_risk
```

Rate each term 0-5.

### blocker_impact

- 5: P0/P1 preventing play/release
- 4: serious quality/reliability gate
- 3: obvious gameplay/content weakness
- 2: meaningful but noncritical improvement
- 1: polish
- 0: no material problem

### player_value

- 5: transforms the core loop or retention
- 4: large clarity/depth/social gain
- 3: strong feature addition
- 2: moderate improvement
- 1: minor polish
- 0: no player-facing benefit

### release_proximity

- 5: this change can immediately unlock production/live promotion
- 4: closes one of few remaining major gates
- 3: moves a viable prototype materially closer
- 2: long path remains
- 1: concept/preproduction
- 0: unrelated to release

### reuse_leverage

- 5: useful to most of the portfolio
- 4: useful to many games
- 3: useful to several games
- 2: reusable within one game family
- 1: title-specific
- 0: disposable

### confidence

- 5: explicitly documented gap + source evidence + clear implementation path
- 4: strong evidence
- 3: reasonable evidence, some unknowns
- 2: speculative
- 1: weak evidence
- 0: unsupported

### implementation_cost

- 5: major multi-repo/engine/backend project
- 4: large feature/refactor
- 3: medium feature
- 2: focused feature
- 1: small fix
- 0: trivial

### migration_risk

- 5: threatens canonical source/save/multiplayer/deployment compatibility
- 4: high integration risk
- 3: moderate regression risk
- 2: controlled risk
- 1: low risk
- 0: isolated/additive

Do not let the formula outrank a real P0/P1 issue. It is a sorting aid, not policy.

## Evidence confidence labels

Attach one of these to major findings:

- **CONFIRMED:** directly supported by current canonical source/tests/docs.
- **OBSERVED:** reproduced in browser/runtime evidence.
- **DOCUMENTED-OPEN:** canonical project explicitly lists it as an open gate.
- **INFERRED:** likely improvement based on current architecture/content scale; verify before coding.
- **EXPERIMENTAL:** optional concept that requires prototype/playtest evidence before adoption.

## Upgrade acceptance

After implementing an upgrade, re-score only the affected dimensions and state what evidence changed. Do not silently raise unrelated dimensions.