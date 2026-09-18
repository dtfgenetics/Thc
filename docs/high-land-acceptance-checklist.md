# High Land acceptance checklist

Use only **PASS**, **FAIL**, or **NOT TESTED** in the Status column. Add concrete evidence for every PASS. Any required FAIL or NOT TESTED blocks a complete or live-ready claim.

## Scope and repository controls

| Check | Status | Evidence |
| --- | --- | --- |
| Change is limited to the requested scope; unrelated work is preserved | NOT TESTED | |
| `AGENTS.md`, `CLAUDE.md`, and all required High Land control docs exist | NOT TESTED | |
| No secrets, `.env` files, credentials, or private room data are committed | NOT TESTED | |
| No unrelated game, pricing, property, or strain content is introduced | NOT TESTED | |
| Retired Playwright config/spec paths are absent | PASS | High Land CI #3447 @ `6928a0e`: browser-tool policy passed with no Playwright execution/dependency wiring or retired High Land browser-test paths. |

## Board, movement, and tokens

| Check | Status | Evidence |
| --- | --- | --- |
| `boardPath` has continuous indexes `0` through `108` | PASS | High Land CI #3447: `boardPath.test.ts` 5/5 passed; continuous index assertion plus approved 109-space count. |
| The route is single, connected, and visits the seven locations in locked order | PASS | High Land CI #3450 @ `df644dc`: `boardPath.test.ts` 6/6 passed, including exact seven-zone order and calibrated consecutive-space continuity. |
| Space types are limited to start, normal, action, and finish | PASS | High Land CI #3447: `gameEngine.test.ts` passed the approved board-image/type contract. |
| Exactly 22 indexes are gameplay HIT/action triggers | PASS | High Land CI #3447: `boardPath.test.ts` and `gameEngine.test.ts` both verify the approved 22 HIT/action indexes. |
| Die results are integers from 1 through 6 | PASS | High Land CI #3447: `gameEngine.test.ts` verifies die clamping/results from 1 through 6. |
| Normal movement equals the rolled number and clamps at START/FINISH | PASS | High Land CI #3447: `gameEngine.test.ts` verifies roll/move behavior and START/FINISH clamping. |
| Movement animates through every traversed index | NOT TESTED | |
| Tokens and colocated-token offsets remain inside board spaces | PASS | High Land CI #3447: `tokenLayoutSystem.test.ts` 2/2 passed for 2–10 colocated players. |
| Reaching Cloud 9 Citadel declares the correct winner | PASS | High Land CI #3447: `gameEngine.test.ts` verifies reaching the final index produces `game_over` with the correct winner ID. |

## HIT cards and turns

| Check | Status | Evidence |
| --- | --- | --- |
| Landing on every HIT index draws and immediately applies a card | PASS | High Land CI #3447: `gameEngine.test.ts` iterates every approved HIT trigger and verifies a card is drawn there and nowhere else. |
| Card text exactly matches each coded effect | NOT TESTED | |
| Forward, backward, color, swap, leader, group, and choice effects are correct | NOT TESTED | |
| Skip turn, roll again, and draw again resolve without stuck or infinite turns | NOT TESTED | |
| Backward protection is consumed correctly | PASS | High Land CI #3447: `gameEngine.test.ts` verifies one-use backward protection blocks movement and is consumed. |
| Reverse turn order works across dice turns, HIT-card turns, and pending choices | PASS | High Land CI #3447: `gameEngine.test.ts` plus `reverseRotationCardTurns.test.ts` 3/3 verify reversed dice/card turns and pending-choice resolution. |
| All card movement remains within START and FINISH | PASS | High Land CI #3447: `actionCards.test.ts` resolves all 39 HIT cards and asserts every resulting player position remains within board bounds. |

## Players and invite multiplayer

| Check | Status | Evidence |
| --- | --- | --- |
| Local setup supports 1-10 entered names and stable fallbacks | NOT TESTED | |
| Online setup supports 2-10 entered names | NOT TESTED | |
| Host creates a room and a usable `?game=ROOMCODE` invite | PASS | High Land CI #3447: `inviteLinks.test.ts` 3/3 and `highLandRoomModeService.test.ts` verify canonical `?game=ROOMCODE` creation/parsing and room creation. |
| A second browser/device joins and both clients show the same lobby | NOT TESTED | |
| Only the host starts and only the active player commits a turn | PASS | High Land CI #3447: `roomActionExecutor.test.ts`, `roomState.test.ts`, and room API security verification reject non-host starts and out-of-turn mutations. |
| Dice, movement, cards, choices, skips, turn order, and winner synchronize | NOT TESTED | |
| Refresh/reconnect restores the player session when possible | NOT TESTED | |
| Public room data excludes secrets and session credentials | PASS | High Land CI #3447: room API security verifier confirms create/join/public reads do not expose `authHash` or host/guest credentials. |

## Automated repository validation

| Check | Status | Evidence |
| --- | --- | --- |
| `npm ci` | PASS | High Land CI #3447 step `Install dependencies` passed. |
| `npm run test:high-land` | PASS | High Land CI #3450: 32 test files / 124 tests passed; room API security verification also passed. |
| `npm run build:high-land` | PASS | High Land CI #3447: TypeScript + Vite production build passed. |
| `node scripts/verify-browser-tool-policy.mjs` | PASS | High Land CI #3447 browser-tool policy step passed. |
| PHP room API lint passes when PHP files exist | PASS | High Land CI #3447 linted public, dist, and test-router PHP room API files with no syntax errors. |
| CI runs deterministic tests, build, room API security, PHP lint, and static asset checks | PASS | High Land CI #3447 completed all required steps; High Land Room Security CI #241 also passed independently. |
| Datadog skips successfully when required secrets are absent | NOT TESTED | |

## Presentation and live deployment

| Check | Status | Evidence |
| --- | --- | --- |
| Desktop and mobile keep the board readable without covered controls | NOT TESTED | |
| Names, active turn, die result, HIT reveal, winner, and 21+ note are clear | NOT TESTED | |
| The exact locally tested artifact is deployed to `/games/high-land/` | NOT TESTED | |
| Live route, assets, and room API return expected responses | NOT TESTED | |
| A real two-browser/device live invite game passes | NOT TESTED | |
| Live mobile layout and browser console pass review | NOT TESTED | |
| Deployed commit and rollback reference are recorded | NOT TESTED | |

## Result

- Commit/branch: baseline evidence `6928a0e245ef22cdb2df1cd4c2c9c1f7e957b8a6`; route-continuity evidence `df644dc77bdd8f200599901807d015b85498ed27`; checklist branch `codex/high-land-acceptance-evidence-20260917`
- Local verification date: 2026-09-17 (High Land CI #3450 and Room Security CI on the same PR)
- Live verification date:
- Overall status: NOT TESTED
- Remaining issues: movement-animation verification, card-text/effect semantic review, remaining setup/synchronization/reconnect coverage, and all real live/mobile/two-device deployment checks.

Use **local validation passed; live deployment NOT TESTED** when the repository checks pass but the public site was not deployed and exercised.
