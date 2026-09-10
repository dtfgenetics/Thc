# High Land acceptance checklist

Use **PASS**, **FAIL**, or **NOT TESTED** with concrete evidence. This checklist validates the resulting game; it does not lock the implementation, route architecture, renderer, backend, board geometry, player count, art source, or test tooling.

## Repository and integrity

| Check | Status | Evidence |
| --- | --- | --- |
| Current implementation and deployment metadata agree | NOT TESTED | |
| No secrets, credentials, private keys, `.env` secrets, or private room/user data are committed | NOT TESTED | |
| Changed code has appropriate syntax/type/build validation | NOT TESTED | |
| Obsolete tests or validators were updated when the design changed | NOT TESTED | |

## Gameplay

| Check | Status | Evidence |
| --- | --- | --- |
| A new game can start and reach its intended finish/win state | NOT TESTED | |
| Movement and turn resolution match the current game design | NOT TESTED | |
| Cards/events/choices resolve without soft locks or infinite loops | NOT TESTED | |
| Player state remains coherent through restart, save, reconnect, or refresh where supported | NOT TESTED | |
| Error states recover cleanly or explain what the player should do | NOT TESTED | |

## Multiplayer when present

| Check | Status | Evidence |
| --- | --- | --- |
| Room creation/join flow works using the current multiplayer architecture | NOT TESTED | |
| Only authorized players can commit protected state changes | NOT TESTED | |
| Two independent browser/device sessions stay synchronized | NOT TESTED | |
| Reconnect/resume behavior works as intended | NOT TESTED | |
| Public responses exclude secrets and private session data | NOT TESTED | |

## Responsive presentation

| Check | Status | Evidence |
| --- | --- | --- |
| Phone layout is intentionally composed and playable | NOT TESTED | |
| Tablet portrait and landscape are usable | NOT TESTED | |
| Laptop/desktop presentation uses available space well | NOT TESTED | |
| Controls do not obscure the playfield | NOT TESTED | |
| Text, state indicators, buttons, cards, tokens, and interactive targets remain legible | NOT TESTED | |
| Keyboard, pointer, and touch input work where supported | NOT TESTED | |
| Reduced-motion/accessibility behavior is reasonable for the resulting UI | NOT TESTED | |

## Visual quality

| Check | Status | Evidence |
| --- | --- | --- |
| The game has a clear visual focal point rather than dashboard-like clutter | NOT TESTED | |
| Final artwork is used where production-ready art exists | NOT TESTED | |
| Missing assets fail gracefully without broken-image icons | NOT TESTED | |
| Animation, VFX, feedback, and state changes are readable | NOT TESTED | |
| Phone/tablet/desktop variants preserve the intended visual identity | NOT TESTED | |

## Build and live release

Run the strongest checks appropriate to the resulting architecture. Current commands may include `npm run test:high-land` and `npm run build:high-land`, but they may be replaced if the implementation changes.

| Check | Status | Evidence |
| --- | --- | --- |
| Automated tests appropriate to the current architecture pass | NOT TESTED | |
| Production build/package completes | NOT TESTED | |
| Public asset paths resolve | NOT TESTED | |
| Exact deployed artifact/revision is identified | NOT TESTED | |
| Exact visitor-facing route loads the expected current game | NOT TESTED | |
| Live phone/tablet/desktop behavior is verified when deployment is in scope | NOT TESTED | |

## Result

- Commit/branch:
- Repository verification date:
- Live verification date:
- Overall status: PASS / FAIL / NOT TESTED
- Remaining issues:

Repository validation and live-route validation must be reported separately.
