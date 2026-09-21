# High Land acceptance checklist

Use only **PASS**, **FAIL**, or **NOT TESTED** in the Status column. Add concrete evidence for every PASS. Any required FAIL or NOT TESTED blocks a complete or live-ready claim.

## Scope and repository controls

| Check | Status | Evidence |
| --- | --- | --- |
| Change is limited to the requested scope; unrelated work is preserved | NOT TESTED | |
| `AGENTS.md`, `CLAUDE.md`, and all required High Land control docs exist | NOT TESTED | |
| No secrets, `.env` files, credentials, or private room data are committed | NOT TESTED | |
| No unrelated game, pricing, property, or strain content is introduced | NOT TESTED | |
| Retired Playwright config/spec paths are absent | NOT TESTED | |

## Board, movement, and tokens

| Check | Status | Evidence |
| --- | --- | --- |
| `boardPath` has continuous indexes `0` through `108` | PASS | `gameEngine.test.ts` verifies continuous indexes; approved board length is 109. High Land CI run 35552372237 passed. |
| The route is single, connected, and visits the seven locations in locked order | PASS | `gameEngine.test.ts` verifies the seven locked zones occur once in path order from Rolling Hills through Cloud 9 Citadel. High Land CI run 35552372237 passed. |
| Space types are limited to start, normal, action, and finish | PASS | `gameEngine.test.ts` checks the complete path against the four allowed space types. High Land CI run 35552372237 passed. |
| Exactly 22 indexes are gameplay HIT/action triggers | PASS | `gameEngine.test.ts` checks `approvedHitSpaceCount`, `actionSpaceIndexes`, and every indexed space type. High Land CI run 35552372237 passed. |
| Die results are integers from 1 through 6 | PASS | `gameEngine.test.ts` exercises lower/upper/random clamps through `rollDie`. High Land CI run 35552372237 passed. |
| Normal movement equals the rolled number and clamps at START/FINISH | PASS | `gameEngine.test.ts` and `turnFeedback.test.ts` verify exact traversed indexes, rolled distance, and START/FINISH clamping. High Land CI run 35552372237 passed. |
| Movement animates through every traversed index | NOT TESTED | |
| Tokens and colocated-token offsets remain inside board spaces | NOT TESTED | |
| Reaching Cloud 9 Citadel declares the correct winner | PASS | `gameEngine.test.ts` plus `fullGameContract.test.ts` verify FINISH winners and complete deterministic games. High Land CI run 35552372237 passed. |

## HIT cards and turns

| Check | Status | Evidence |
| --- | --- | --- |
| Landing on every HIT index draws and immediately applies a card | PASS | `gameEngine.test.ts` checks every approved HIT trigger, rejects draws elsewhere, and verifies an applied production card effect. High Land CI run 35552372237 passed. |
| Card text exactly matches each coded effect | PASS | `actionCards.test.ts` locks all 39 approved visible instructions, validates effect shapes/values, resolves every production card, and exercises the multi-target/extra-turn families. High Land CI run 35552372237 passed. |
| Forward, backward, color, swap, leader, group, and choice effects are correct | PASS | `gameEngine.test.ts`, `effectResolver.choice.test.ts`, and `actionCards.test.ts` exercise these effect families using deterministic positions and production cards. High Land CI run 35552372237 passed. |
| Skip turn, roll again, and draw again resolve without stuck or infinite turns | PASS | `actionCards.test.ts` exercises production skip/roll/draw cards; `cardSystemRegression.test.ts` and `fullGameContract.test.ts` prove chained draws and complete deterministic games terminate. High Land CI run 35552372237 passed. |
| Backward protection is consumed correctly | PASS | `gameEngine.test.ts` verifies one backward-protection use blocks movement and decrements to zero. High Land CI run 35552372237 passed. |
| Reverse turn order works across dice turns, HIT-card turns, and pending choices | PASS | `gameEngine.test.ts` and `reverseRotationCardTurns.test.ts` verify reversed dice turns, HIT-card advancement, pending-choice resolution, and clockwise restoration. High Land CI run 35552372237 passed. |
| All card movement remains within START and FINISH | PASS | `actionCards.test.ts` resolves every production HIT card and asserts every resulting player position stays within `0..finishIndex`; `fullGameContract.test.ts` repeats the invariant during long games. High Land CI run 35552372237 passed. |

## Players and invite multiplayer

| Check | Status | Evidence |
| --- | --- | --- |
| Local setup supports 1-10 entered names and stable fallbacks | NOT TESTED | |
| Online setup supports 2-10 entered names | NOT TESTED | |
| Host creates a room and a usable `?game=ROOMCODE` invite | NOT TESTED | |
| A second browser/device joins and both clients show the same lobby | NOT TESTED | |
| Only the host starts and only the active player commits a turn | NOT TESTED | |
| Dice, movement, cards, choices, skips, turn order, and winner synchronize | NOT TESTED | |
| Refresh/reconnect restores the player session when possible | NOT TESTED | |
| Public room data excludes secrets and session credentials | NOT TESTED | |

## Automated repository validation

| Check | Status | Evidence |
| --- | --- | --- |
| `npm ci` | PASS | High Land CI run 35552372237 completed the dependency-install step successfully. |
| `npm run test:high-land` | PASS | High Land CI run 35552372237 completed the canonical deterministic test step successfully. |
| `npm run build:high-land` | PASS | High Land CI run 35552372237 completed the canonical app build successfully. |
| `node scripts/verify-browser-tool-policy.mjs` | PASS | High Land CI run 35552372237 completed the browser-tool policy step successfully; Playwright remains retired from this workflow. |
| PHP room API lint passes when PHP files exist | PASS | High Land CI run 35552372237 completed the PHP room-API lint step successfully. |
| CI runs deterministic tests, build, room API security, PHP lint, and static asset checks | PASS | High Land CI run 35552372237 and High Land Room Security CI run 35552372246 both passed; the canonical workflow also verifies the built entrypoint/assets. |
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

- Commit/branch: `test/high-land-acceptance-v1` (`616cc7a3bb080125f3da6ec460fac88e3ce170d7` acceptance-test head before checklist evidence update)
- Local verification date: 2026-09-20 (America/Chicago)
- Live verification date: NOT TESTED
- Overall status: NOT TESTED
- Remaining issues: browser/device invite validation, token-offset presentation, live deployment verification, mobile/browser-console review, deployed commit/rollback record, and other rows still marked NOT TESTED.

Use **local validation passed; live deployment NOT TESTED** when the repository checks pass but the public site was not deployed and exercised.
