# 3x Failure Review

## Review 1

Problem: code may not run yet.

Fix:

- Run install.
- Run unit tests.
- Run build.
- Fix any TypeScript error first.

## Review 2

Problem: browser behavior may still fail.

Fix:

- Run Playwright checks.
- Test 10 player mode.
- Test roll button.
- Test save and load.
- Test phone layout.

## Review 3

Problem: final assets are not imported yet.

Fix:

- Add board image.
- Add card images.
- Add audio files.
- Calibrate board positions.
- Deploy to `/games/high-land/`.

## Clear goal

A playable local browser game that passes tests and builds for the website path.
