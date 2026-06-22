# High Land Code Status Map

This map shows what has been built, what is safe, and what still needs wiring.

## Working local gameplay

```txt
apps/high-land-web/src/App.tsx
apps/high-land-web/src/game/systems/gameEngine.ts
apps/high-land-web/src/game/systems/playerSystem.ts
apps/high-land-web/src/ui/PhaserBoard.tsx
apps/high-land-web/src/ui/DiceDisplay.tsx
apps/high-land-web/src/ui/CardRevealModal.tsx
```

Status: playable local prototype.

## Named player setup

```txt
apps/high-land-web/src/ui/PlayerSetupForm.tsx
apps/high-land-web/src/game/players/playerIdentity.ts
apps/high-land-web/src/app/highLandAppFlow.ts
apps/high-land-web/src/app/highLandRoomModeService.ts
```

Status: built. App has named-player flow and uses the room-mode service for local room actions. React type-only imports have been cleaned up.

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

Status: local fallback systems are built. App can create a local room, show invite link, add a local test player, and start from lobby. Local test players are capped at the game max.

## Room gameplay runtime

```txt
apps/high-land-web/src/app/highLandRoomRuntime.ts
apps/high-land-web/src/game/multiplayer/roomGameFactory.ts
apps/high-land-web/src/game/multiplayer/roomGameActions.ts
apps/high-land-web/src/game/multiplayer/roomActionExecutor.ts
```

Status: built and wired into App for room start, restart, and roll. Room-mode gameplay now uses the transport-backed runtime path, and room player IDs/tokens/colors are preserved in game state.

## Multiplayer transport boundary

```txt
apps/high-land-web/src/game/multiplayer/roomTransport.ts
apps/high-land-web/src/game/multiplayer/localRoomTransport.ts
apps/high-land-web/src/game/multiplayer/supabaseRoomTransport.ts
apps/high-land-web/src/game/multiplayer/roomTransportFactory.ts
```

Status: local transport works, Supabase transport is a safe stub. Local storage helpers now fail with clear messages outside the browser instead of touching `window.localStorage` in default parameters.

## Event logging

```txt
apps/high-land-web/src/game/events/gameEvents.ts
apps/high-land-web/src/game/multiplayer/localRoomEvents.ts
```

Status: local event log is built and room-mode actions append local events through the transport path. Supabase event table mapping is ready.

## Supabase mapping and schema planning

```txt
apps/high-land-web/src/game/multiplayer/supabaseClient.ts
apps/high-land-web/src/game/multiplayer/supabaseRoomTypes.ts
apps/high-land-web/src/game/multiplayer/supabaseRoomMapper.ts
docs/HIGH_LAND_SUPABASE_SCHEMA_DRAFT.md
docs/HIGH_LAND_MULTIPLAYER_TRANSPORTS.md
```

Status: schema draft and row mappers exist. Live Supabase writes are not implemented yet.

## Runner setup

```txt
.github/workflows/high-land-ci.yml
.devcontainer/devcontainer.json
docs/RUN_HIGH_LAND_CODE.md
```

Status: GitHub Actions has a manual trigger. Codespaces has a dev container. Runner instructions exist for Codespaces, GitHub Actions, Replit, Cursor, and Windsurf.

## Tests added

```txt
apps/high-land-web/src/app/highLandAppFlow.test.ts
apps/high-land-web/src/app/highLandRoomModeService.test.ts
apps/high-land-web/src/app/highLandRoomRuntime.test.ts
apps/high-land-web/src/game/multiplayer/localRoomRepository.test.ts
apps/high-land-web/src/game/multiplayer/localRoomFlow.test.ts
apps/high-land-web/src/game/multiplayer/roomGameFactory.test.ts
apps/high-land-web/src/game/multiplayer/roomSessionController.test.ts
apps/high-land-web/src/game/multiplayer/roomTransport.test.ts
apps/high-land-web/src/game/multiplayer/localRoomTransport.test.ts
apps/high-land-web/src/game/multiplayer/supabaseRoomTransport.test.ts
apps/high-land-web/src/game/multiplayer/roomTransportFactory.test.ts
apps/high-land-web/src/game/multiplayer/localRoomEvents.test.ts
apps/high-land-web/src/game/multiplayer/supabaseRoomMapper.test.ts
apps/high-land-web/src/game/multiplayer/roomGameActions.test.ts
apps/high-land-web/src/game/multiplayer/roomActionExecutor.test.ts
apps/high-land-web/e2e/high-land.spec.ts
```

Status: tests exist, but must be run locally/CI.

## Immediate next wiring tasks

```txt
1. Open GitHub Codespaces or manually run High Land CI.
2. Run npm run test:high-land.
3. Run npm run build:high-land.
4. Fix any actual TypeScript/test/build failures.
5. Convert Supabase schema draft into a reviewed migration.
6. Implement Supabase room transport after migration approval.
7. Deploy and check https://dtfseeds.com/games/high-land/.
```

## Do not claim done until

```txt
- Tests pass.
- Build passes.
- Live route loads with no console errors.
- Player names work.
- Invite link is visible.
- Room lobby works locally.
- Supabase live multiplayer works in two browsers.
```
