# High Land acceptance checklist

Use only **PASS**, **FAIL**, or **NOT TESTED** in the Status column. Add concrete
evidence for every PASS. Any required FAIL or NOT TESTED blocks a complete or
live-ready claim.

## Scope and repository controls

| Check | Status | Evidence |
| --- | --- | --- |
| Change is limited to the requested scope; unrelated work is preserved | NOT TESTED | |
| `AGENTS.md`, `CLAUDE.md`, and all required High Land control docs exist | NOT TESTED | |
| No secrets, `.env` files, credentials, or private room data are committed | NOT TESTED | |
| No unrelated game, pricing, property, or strain content is introduced | NOT TESTED | |

## Board, movement, and tokens

| Check | Status | Evidence |
| --- | --- | --- |
| `boardPath` has continuous indexes `0` through `110` | NOT TESTED | |
| The route is single, connected, and visits the seven locations in locked order | NOT TESTED | |
| Space types are limited to start, normal, action, and finish | NOT TESTED | |
| Exactly 25 indexes are gameplay HIT/action triggers | NOT TESTED | |
| Die results are integers from 1 through 6 | NOT TESTED | |
| Normal movement equals the rolled number and clamps at START/FINISH | NOT TESTED | |
| Movement animates through every traversed index | NOT TESTED | |
| Tokens and colocated-token offsets remain inside board spaces | NOT TESTED | |
| Reaching Cloud 9 Citadel declares the correct winner | NOT TESTED | |

## HIT cards and turns

| Check | Status | Evidence |
| --- | --- | --- |
| Landing on every HIT index draws and immediately applies a card | NOT TESTED | |
| Card text exactly matches each coded effect | NOT TESTED | |
| Forward, backward, color, swap, leader, group, and choice effects are correct | NOT TESTED | |
| Skip turn, roll again, and draw again resolve without stuck or infinite turns | NOT TESTED | |
| Backward protection is consumed correctly | NOT TESTED | |
| Reverse turn order works when included | NOT TESTED | |
| All card movement remains within START and FINISH | NOT TESTED | |

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

## Automated local validation

| Check | Status | Evidence |
| --- | --- | --- |
| `npm ci` | NOT TESTED | |
| `npm run test:high-land` | NOT TESTED | |
| `npm run build:high-land` | NOT TESTED | |
| `npm run test:e2e:high-land` | NOT TESTED | |
| PHP room API lint passes when PHP files exist | NOT TESTED | |
| CI runs unit tests, build, and browser smoke tests | NOT TESTED | |
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

- Commit/branch:
- Local verification date:
- Live verification date:
- Overall status: PASS / FAIL / NOT TESTED
- Remaining issues:

Use **local validation passed; live deployment NOT TESTED** when the repository
checks pass but the public site was not deployed and exercised.
