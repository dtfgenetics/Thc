# High Land Board Mechanics Map

This file locks the movement rules for **High Land: The Sweet Escape** so Codex does not keep moving player pieces off the board or using placeholder movement.

## Source image

Use the uploaded High Land board art as the current board-art target. The game code must not guess movement from pixels at runtime. It must use a numbered path data file.

The current coordinate implementation lives in:

```txt
packages/shared-game-rules/src/high-land/boardPath.ts
packages/shared-game-rules/src/high-land/movementSystem.ts
packages/shared-game-rules/src/high-land/playerTokens.ts
packages/shared-game-rules/src/high-land/boardPathValidation.ts
packages/shared-game-rules/src/high-land/movementSystem.test.ts
```

## Count

The current playable coordinate map contains **109 numbered landing spaces**.

Important: this is the code-authoritative playable path count. The AI board art has visual distortions, decorative colored areas, and some apparent disconnected/warped spaces. Do not rely on automatic pixel counting as the rule source. The `BOARD_SPACES` array is the rule source.

## Start rule

Players do **not** begin on numbered space 1.

Players begin on the START staging anchor with:

```ts
player.position = 0;
```

That means:

- `0` = START staging / before the first playable action space.
- `1` = first playable board space.
- `2` = second playable board space.
- `109` = finish landing space.

A roll always moves by exactly the dice amount unless a HIT card or written rule changes it.

Example:

```txt
Start position: 0
Dice roll: 6
Move sequence: 1 -> 2 -> 3 -> 4 -> 5 -> 6
Final position: 6
```

This fixes the off-by-one error where a roll of 6 lands on the 5th or 7th visible space.

## Movement rule

Every movement is index-based:

```ts
target = currentPosition + diceRoll;
```

Then clamp to finish:

```ts
target = Math.min(target, FINISH_POSITION);
```

Backward movement from HIT cards clamps to START:

```ts
target = Math.max(0, currentPosition + cardAmount);
```

## Animation rule

Tokens must animate through each numbered step, not teleport.

For a roll of 6 from START, the animation list must be:

```txt
[1, 2, 3, 4, 5, 6]
```

The token should render at each step's `x/y` coordinate and finish sitting on step 6.

## HIT rule

HIT spaces only add extra movement when the HIT card says so.

Dice movement resolves in this order:

1. Roll dice.
2. Move exactly that number of spaces.
3. Sit on the final landed space.
4. If that final space is HIT, draw exactly one HIT card.
5. Apply the card effect.
6. Any card movement must use the same numbered path system.

Passing over a HIT space during dice movement does not trigger that HIT. Only the landed space triggers.

## Four-player token rule

All four pieces must live on the board coordinate they occupy.

When multiple pieces share one board space, use a small offset around the same anchor point. Do not push them into another square and do not place them off to the side of the board.

The four renamed player pieces are defined in `playerTokens.ts`:

1. Sprout Scout
2. Rosin Rocket
3. Munchie Mage
4. Cloud Crown

These replace placeholder names such as Player 1 / Token A.

## Coordinate scaling rule

The source board image used for this coordinate map is treated as:

```txt
1536 x 1152
```

Render coordinates must scale against the actual displayed board size:

```ts
scaledX = boardLeft + (space.x / 1536) * renderedBoardWidth;
scaledY = boardTop + (space.y / 1152) * renderedBoardHeight;
```

Never hardcode CSS positions against the browser window alone. Coordinates must be relative to the board image.

## Codex acceptance tests

Codex must verify these before saying the mechanics are fixed:

- Roll 6 from START lands on space 6.
- Roll 1 from START lands on space 1.
- Position never becomes negative.
- Position never exceeds 109.
- A player token always renders at START or a numbered board space.
- Four players on one space render with four distinct small offsets.
- HIT card movement uses the same path and cannot jump to unlisted coordinates.
- `BOARD_SPACES.map(space => space.position)` is exactly `[1, 2, 3, ... 109]`.
- Every board space has x/y coordinates.
- No movement code uses random board coordinates.

## GitHub references

Use the existing project reference document for architecture choices:

```txt
docs/GITHUB_CODE_TO_USE.md
```

The implementation added here is custom code. It is not copied from a public repository. The public GitHub projects listed in `GITHUB_CODE_TO_USE.md` should be treated as structure references only unless a future commit adds a third-party notice.
