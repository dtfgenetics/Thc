# High Land Code Status Map

This map shows what has been built, what is safe, and what still needs wiring.

## Approved front page

The current High Land game page front is approved and should be preserved. Continue fixing code, tests, build, runtime, deployment, and multiplayer wiring, but do not redesign the public front-page look unless a future task explicitly asks for a redesign.

## Current validation contract

High Land uses deterministic repository validation:

```bash
npm ci
npm run test:high-land
npm run build:high-land
node scripts/verify-browser-tool-policy.mjs
```

Playwright config/spec files are retired from the active High Land gate. Manual browser review and live two-device checks remain required before a live-ready claim.

## Working local gameplay

```txt
apps/high-land-web/src/App.tsx
apps/high-land-web/src/game/systems/gameEngine.ts
apps/high-land-web/src/game/systems/playerSystem.ts
apps/high-land-web/src/ui/PhaserBoard.tsx
apps/high-land-web/src/ui/DiceDisplay.tsx
apps/high-land-web/src/ui/CardRevealModal.tsx
```

Status: playable local prototype. Phaser board removes stale player tokens when player lists change and binds global game-state listener cleanup to Phaser shutdown/destroy lifecycle events.

## Named player setup

```txt
apps/high-land-web/src/ui/PlayerSetupForm.tsx
apps/high-land-web/src/game/players/playerIdentity.ts
apps/high-land-web/src/app/highLandAppFlow.ts
apps/high-land-web/src/app/highLandRoomModeService.ts
```

Status: built. App has named-player flow and uses the room-mode service for local room actions.

## Room and lobby fallback

```txt
apps/high-land-web/src/ui/RoomLobby.tsx
apps/high-land-web/src/game/multiplayer/roomCodes.ts
apps/high-land-web/src/game/multiplayer/inviteLinks.ts
apps/high-land-web/src/game/multiplayer/roomState.ts
apps/high-land-web/src/game/multiplayer/localRoomStorage.ts
apps/high-land-web/src/game/multiplayer/localRoomRepository.ts
apps/high-land-web/src/game/multiplayer/localRoomFlow.ts
apps/high-land-web/src/game/multiplayer/roomSessionController.ts
```

Status: local fallback systems are built. App can create a local room, show invite link, add a local test player, and start from lobby. Room state enforces the 10-player max at the source layer. Invite URLs open the join-room flow with the room code prefilled.

## Room gameplay runtime

```txt
apps/high-land-web/src/app/highLandRoomRuntime.ts
apps/high-land-web/src/game/multiplayer/roomGameFactory.ts
apps/high-land-web/src/game/multiplayer/roomGameActions.ts
apps/high-land-web/src/game/multiplayer/roomActionExecutor.ts
```

Status: built and wired into App for room start, restart, and roll. Room-mode gameplay uses the transport-backed runtime path, and room player IDs/tokens/colors are preserved in game state.

## Board labels and HIT cards

```txt
apps/high-land-web/src/game/data/boardPath.ts
apps/high-land-web/src/game/data/actionCards.ts
apps/high-land-web/src/game/systems/cardSystem.ts
apps/high-land-web/src/game/systems/effectResolver.ts
apps/high-land-web/src/game/systems/turnSystem.ts
apps/high-land-web/src/ui/CardRevealModal.tsx
```

Status: action spaces use the High Land `HIT` label. HIT card reveal UI uses `HIT CARD`. Reverse Rotation is required to work through dice turns, normal card turns, and pending choice resolution.

## Multiplayer transport boundary

```txt
apps/high-land-web/src/game/multiplayer/roomTransport.ts
apps/high-land-web/src/game/multiplayer/localRoomTransport.ts
apps/high-land-web/src/game/multiplayer/websiteRoomTransport.ts
apps/high-land-web/src/game/multiplayer/roomTransportFactory.ts
```

Status: local transport works and the live DTF Seeds route selects the Hostinger website transport. Local storage helpers fail clearly outside the browser.

## Website Room API

```txt
apps/high-land-web/public/api/
apps/high-land-web/src/game/multiplayer/websiteRoomApi.ts
apps/high-land-web/src/game/multiplayer/websiteRoomTransport.ts
docs/HIGH_LAND_MULTIPLAYER_TRANSPORTS.md
```

Status: API boundary is guarded. Full two-device game-state synchronization remains an acceptance test, not an assumed pass.

## Tests that matter before release

```txt
apps/high-land-web/src/**/*.test.ts
apps/high-land-web/src/**/*.test.tsx
scripts/verify-browser-tool-policy.mjs
.github/workflows/high-land-ci.yml
```

Status: deterministic tests must pass. Browser/live review must be recorded separately.

## Immediate next wiring tasks

```txt
1. Confirm npm run test:high-land passes.
2. Confirm npm run build:high-land passes.
3. Confirm node scripts/verify-browser-tool-policy.mjs passes.
4. Run the live API guard checks.
5. Run the complete two-browser/device room acceptance test.
6. Deploy the exact tested artifact to /games/high-land/.
7. Verify https://dtfseeds.com/games/high-land/ visitor-facing behavior.
```

## Do not claim done until

```txt
- Unit tests pass.
- Build passes.
- Browser-tool policy passes.
- Live route loads with no console errors after deployment.
- Player names work.
- Invite link is visible and opens join flow.
- Room lobby works locally.
- Hostinger Website Room API multiplayer works in two browsers.
```
