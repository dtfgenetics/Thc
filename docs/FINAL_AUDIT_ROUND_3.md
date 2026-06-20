# Final Audit Round 3

## Pass 1: Structure

Status: improved.

Done:

- Web app exists.
- Server scaffold exists.
- Ten player option exists.
- Production base path is set for `/games/high-land/`.
- Browser test files exist.

Still needs terminal proof:

- Install.
- Unit tests.
- Build.
- Browser tests.

## Pass 2: Rules

Status: improved.

Done:

- Dice rules exist.
- Movement rules exist.
- Card system exists.
- Extra card effects exist.
- Card chaining has a regression test.
- Group movement winner case has a regression test.

Still needs terminal proof:

- Run all unit tests.
- Fix any TypeScript errors.
- Play through at least one full game.

## Pass 3: Visual and website readiness

Status: improved but not final.

Done:

- Board image folder exists.
- Card image folder exists.
- Audio folder exists.
- Board scene loads assets through the Vite base path.
- Dice display component exists.
- Card reveal component exists.

Still needed:

- Add final board image.
- Add final card images.
- Add final audio.
- Calibrate board coordinates.
- Finish CSS polish.
- Upload the built files to `/games/high-land/`.

## Clear goal

Make the local browser build pass install, tests, build, and browser tests. Then add final assets and calibrate the board.
