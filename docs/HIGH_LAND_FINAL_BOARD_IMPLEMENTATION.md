# High Land Final Board Implementation

Final board rules:

- Use the uploaded final board art for visuals.
- Use the black-background path image for movement mapping.
- There are 110 playable board spaces.
- Position 0 is an invisible start staging box before the first colored space.
- A roll of 6 from position 0 lands on space 6.
- Winning does not require an exact roll. Reaching or passing space 110 ends the game.
- Only the final landed square resolves an action. Passing over an action square does not resolve it.
- Player names must be entered before play and shown in the turn display and winner popup.
- Tokens must render inside their current board square. Shared spaces use small in-square offsets.
- The public UI should remove Save and Load.
- Invite multiplayer requires a server-owned room. Local state is not real multiplayer.

Files added for Codex:

- apps/high-land-web/src/game/systems/finalBoardMovement.ts
- apps/high-land-web/src/game/systems/finalBoardMovement.test.ts
- apps/high-land-web/src/game/systems/inviteCodeSystem.ts

Required implementation changes:

1. Replace the old path with exactly 110 board-space center points.
2. Keep board coordinates in the original 1536 by 1152 art coordinate system.
3. Render position 0 at a separate start anchor near the START area.
4. Render spaces 1 through 110 at exact square centers.
5. Clamp moves at 110 and trigger winner state immediately.
6. Add a winner animation/modal using the winning player name.
7. Add player-name inputs before game start.
8. Add invite-code room flow backed by a server, not a placeholder.

Acceptance tests:

- Start plus roll 1 lands on 1.
- Start plus roll 6 lands on 6.
- Space 10 plus roll 6 lands on 16.
- Space 108 plus roll 6 wins at 110.
- Four tokens sharing one square remain visible inside that square.
- No player moves except the active player unless a card explicitly says so.
