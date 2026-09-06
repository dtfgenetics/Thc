# DTF Game Production Definition of Done

A game may be described as production-ready only when all applicable critical gates pass.

## 1. Canonical source

- canonical owner/path is resolved,
- no duplicate `v2/v3/final` source is being treated as canonical by convenience,
- source map/registry metadata is consistent,
- changes live in the canonical implementation.

## 2. Core gameplay

- game starts reliably,
- new game/start flow works,
- primary control/turn/action works,
- core loop is understandable without developer knowledge,
- required win/completion state works,
- required fail/loss state works,
- restart/reset works,
- no known blocker can soft-lock the normal session.

## 3. Controls and responsive behavior

- desktop input works where supported,
- touch input works for public mobile-targeted games,
- controls do not conflict with menus/modals,
- critical touch targets are usable,
- portrait/landscape behavior is defined rather than accidental,
- UI does not obscure the main playfield at target breakpoints.

## 4. Visual quality

- player focus is immediately identifiable,
- interactive elements have clear affordances,
- hover/press/action/hit/win/loss feedback is visible,
- typography is readable,
- assets are not obviously placeholders unless the game is explicitly a prototype,
- animation timing supports gameplay readability,
- no stretched, clipped, missing, or obviously low-quality critical images/models are present.

## 5. Asset quality

- source vs runtime assets are separated,
- asset names and manifest keys are stable,
- missing assets fail validation rather than silently disappearing,
- 3D scale/pivot/orientation are correct,
- collision proxies exist where required,
- runtime textures/models/audio have justified sizes,
- browser 3D assets are optimized before shipping.

## 6. Audio

Where audio exists:

- no browser autoplay-policy failure,
- master volume/mute works,
- music and SFX/voice categories can be controlled where appropriate,
- repeated events do not create uncontrolled overlapping audio,
- generated voice has source-script/provenance records where required.

## 7. Save and persistence

Where persistence exists:

- fresh start works with no stored data,
- save/load roundtrip works,
- malformed/old data does not crash startup,
- reset/clear-save behavior is defined,
- renderer/engine objects are not serialized as game state.

## 8. Performance

- target device classes are stated,
- startup/load size is measured,
- largest assets are identified,
- no known runaway memory/timer/listener growth occurs during a normal session,
- frame rate is acceptable for the intended gameplay,
- expensive effects have a fallback/quality strategy when necessary.

## 9. Automated validation

At least the strongest applicable set must pass:

- lint/static checks,
- unit/state tests,
- data/schema/asset checks,
- production build,
- automated interaction/E2E test,
- visual regression check for UI-heavy games.

Do not disable a meaningful gate just to make the branch green.

## 10. Release evidence

Use `dtf-game-canonical-release` after production work.

Report evidence separately as:

- SOURCE VALIDATED,
- SUITE VALIDATED,
- DEPLOYED,
- LIVE ROUTE VERIFIED,
- BROWSER PLAYTESTED.

Only claim the highest level actually proven.

## Severity policy

### P0 blocker

Crash, data loss, security issue, inaccessible game route, or core loop impossible to complete/start.

### P1 major

Broken controls, severe mobile failure, major gameplay soft-lock, missing critical asset, or performance issue that makes normal play impractical.

### P2 quality

Confusing UX, weak feedback, visual inconsistency, non-critical asset/animation/audio problem, incomplete accessibility behavior.

### P3 polish

Optional effect, secondary animation, cosmetic enhancement, nonessential content expansion.

Production-ready requires zero known P0/P1 issues. P2/P3 issues may remain only when explicitly recorded and judged non-blocking.
