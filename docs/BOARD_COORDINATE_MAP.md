# Board Coordinate Map

The game logic must not guess token positions from the art. All token movement must use `boardPath.ts`.

## Current coordinate source

```txt
apps/high-land-web/src/game/data/boardPath.ts
```

Current Phaser canvas size:

```txt
800 x 900
```

## Coordinate rules

Each board space must include:

```ts
{
  index: number;
  x: number;
  y: number;
  color: 'red' | 'yellow' | 'green' | 'blue' | 'purple' | 'special';
  type: 'normal' | 'action' | 'skip' | 'boost' | 'trap' | 'safe' | 'start' | 'finish';
  label?: string;
  zone?: string;
}
```

## Calibration process for final art

When the final board image is added:

1. Put the board image at `public/assets/images/board/high-land-board.png`.
2. Run the app locally.
3. Compare every path marker to the printed/visual path spaces.
4. Adjust `x` and `y` values in `boardPath.ts` until token centers match the art.
5. Do not move tokens by CSS.
6. Do not move tokens by guessing from the image.
7. Keep path indexes continuous from START to FINISH.

## Verification checklist

- Space 0 is START.
- Final index is FINISH.
- Every index increments by 1.
- Every space has finite x/y coordinates.
- Token movement follows index order.
- Tokens remain above the board art.
- The final image can be swapped without rewriting game rules.
