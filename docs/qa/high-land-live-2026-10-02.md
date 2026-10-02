# High Land live verification — 2026-10-02

Scope: post-deployment multiplayer acceptance evidence for the room-subscription fix in PR #1522, merged at `4967b4a9dc106dc06a5450ab8d06b3d2c8cab826`.

Public route: https://dtfseeds.com/games/high-land/
Production publishing run: https://github.com/dtfgenetics/Thc/actions/runs/37037872953 (success).
Verified live entry bundle: `/games/high-land/assets/index-D6Tn9JB1.js`.
Live SHA-256: `125ee3964330ee9d18a832095b44f0d76b0c3cf4d9cba9f7ca8758e4d761bad3`, identical to the tested build from the previous release validation.
Browser observations: approximately 20:10–20:15 UTC, 2026-10-02.

| Acceptance check | Result | Evidence |
| --- | --- | --- |
| Named host creates an online room and invite | PASS | Live UI created a room and showed a shareable invite URL. |
| Separate session joins with its own player name | PASS | A second tab with separate session storage joined as a distinct guest. This is two tab sessions, not two physical devices. |
| Both clients see the same lobby | PASS | Host and guest names appeared in both clients through polling. |
| Only host can start | PASS | Start disabled on guest; enabled on host once guest joined. |
| Only active player can roll | PASS | Guest roll disabled during host turn; host roll disabled during guest turn. |
| Dice and position synchronize | PASS | Host rolled 6: space 1 to 7. Guest rolled 3: space 1 to 4. Both clients showed identical positions, die results and active player. |
| Guest and host refresh recovery | PASS | Each tab automatically rejoined with its saved name and resumed the same positions and turn authority after reload. |
| Public room response hides credential fields | PASS (limited) | Public response for this test room had no authHash, credential or tokenHash fields. Prior exact-head room security CI provides the broader authorization evidence. |
| Game-origin console errors | PASS (observed flows) | No errors/warnings matching dtfseeds.com were captured. Browser extension errors were separate from the game. |
| Phone rendering and touch interaction | NOT TESTED | Available browser controls did not produce a phone viewport. CSS inspection does not substitute for rendered phone QA. |
| All HIT effects, choices, skips, reverse turns and winner synchronization | NOT TESTED LIVE | Covered by deterministic release tests; this live session exercised normal host/guest turns, not every special effect or a complete match. |
| Ten-player room and multiple physical devices | NOT TESTED | No evidence claimed from the two-session check. |
| Audio output quality | NOT TESTED | No listening evidence recorded. |

The subscription regression was reproduced against the original code and passed after the fix during PR #1522 validation. All 158 unit tests, TypeScript/Vite build, room security CI, package qualification, and release workflows passed on the fixed candidate. This report adds live multiplayer evidence; it does not mark the entire game or portfolio complete.
