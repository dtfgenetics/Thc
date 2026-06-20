# Final Three Pass Verification

This file is the final handoff checklist for Codex.

## Pass 1: Structure

Goal: prove the app structure matches the game plan.

Verify:

- `apps/high-land-web/src/game/types/gameTypes.ts` supports tokenA through tokenJ.
- `apps/high-land-web/src/game/systems/playerSystem.ts` allows 2 through 10 players.
- `apps/high-land-web/src/App.tsx` exposes 2, 3, 4, 5, 6, 8, and 10 player choices.
- `apps/high-land-server/src/rooms/GameRoom.ts` uses 10 clients for the future online room.

Commands:

```bash
cd apps/high-land-web
npm install
npm run test
npm run build
```

Pass condition:

- Tests pass.
- Build succeeds.
- 10 player mode starts in the browser.

## Pass 2: Game Rules

Goal: prove the cards and movement match the game.

Verify:

- Forward movement works.
- Backward movement works.
- Protection blocks one backward move.
- Color movement finds the next or previous matching color.
- Turn order can reverse.
- Draw-again chains into one extra card safely.
- If any player reaches the finish because of a card, that player wins.

Files to inspect:

```txt
apps/high-land-web/src/game/systems/cardSystem.ts
apps/high-land-web/src/game/systems/effectResolver.ts
apps/high-land-web/src/game/systems/targetingSystem.ts
apps/high-land-web/src/game/data/actionCards.ts
```

Pass condition:

- No card leaves the game in an unresolved phase.
- No card moves a player below space 0 or beyond finish.
- Winner is detected after movement cards and group cards.

## Pass 3: Runtime and Website Readiness

Goal: prove the game can live on dtfseeds.com.

Verify:

- The Phaser board loads.
- Tokens are visible above the board.
- Ten tokens on the same space spread out instead of stacking.
- The final board image can be placed at `apps/high-land-web/public/assets/images/board/high-land-board.png`.
- If that image is missing, the fallback board still appears.
- Save and load do not crash.
- The production build outputs to `apps/high-land-web/dist`.

Deployment target:

```txt
https://dtfseeds.com/games/high-land/
```

Pass condition:

- Public static build works without console errors.
- Mobile layout is usable.
- No unrelated game code is loaded.

## Known tool limitation

This chat can create and update text files in GitHub. It cannot upload the binary board and card PNGs into GitHub through the current connector. Codex or the user must place the final PNG assets into the locked asset paths.
