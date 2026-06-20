# Asset Manifest

This file tracks every visual and audio asset needed for the game.

## Current status

The current prototype renders a built-in placeholder board with Phaser shapes. That lets the game run before final art exists.

Final art still needs to be dropped into:

```txt
apps/high-land-web/public/assets/
```

## Required image assets

| Asset | Target path | Status | Notes |
|---|---|---:|---|
| Board background | `public/assets/images/board/background.png` | Missing | Full fantasy board art without UI controls. |
| Board path overlay | `public/assets/images/board/path-overlay.png` | Missing | Transparent PNG path if separate from background. |
| Start marker | `public/assets/images/board/start.png` | Missing | Transparent PNG. |
| Finish marker | `public/assets/images/board/finish.png` | Missing | Transparent PNG. |
| Player token 1 | `public/assets/images/tokens/token-1.png` | Missing | Transparent PNG. |
| Player token 2 | `public/assets/images/tokens/token-2.png` | Missing | Transparent PNG. |
| Player token 3 | `public/assets/images/tokens/token-3.png` | Missing | Transparent PNG. |
| Player token 4 | `public/assets/images/tokens/token-4.png` | Missing | Transparent PNG. |
| Dice faces | `public/assets/images/dice/dice-1.png` through `dice-6.png` | Missing | Can be sprite sheet or separate files. |
| Card back | `public/assets/images/cards/card-back.png` | Missing | Used for draw animation. |
| Card front template | `public/assets/images/cards/card-front.png` | Missing | Optional if UI renders cards with HTML. |
| Loading logo | `public/assets/images/ui/loading-logo.png` | Missing | Optional but recommended. |

## Required audio assets

| Asset | Target path | Status | Notes |
|---|---|---:|---|
| Background loop | `public/assets/audio/music-loop.mp3` | Missing | Must loop cleanly. |
| Dice roll | `public/assets/audio/dice-roll.mp3` | Missing | Short sound. |
| Move tick | `public/assets/audio/move-tick.mp3` | Missing | Played per space or lightly during animation. |
| Card draw | `public/assets/audio/card-draw.mp3` | Missing | Short draw/reveal sound. |
| Positive effect | `public/assets/audio/card-positive.mp3` | Missing | Forward/bonus card. |
| Negative effect | `public/assets/audio/card-negative.mp3` | Missing | Backward/skip card. |
| Victory | `public/assets/audio/victory.mp3` | Missing | End game sound. |

## Asset rules

- Use real transparent PNGs only when transparency is expected.
- Never use fake checkerboard backgrounds.
- Keep assets lightweight for mobile loading.
- Prefer PNG/WebP for images and MP3/OGG/WebM for audio.
- Do not use copyrighted Candy Land art, board graphics, logos, card text, or layout.

## Codex next step

When final assets are available, Codex should update `BoardScene.ts` to preload and render image assets instead of the shape-based placeholder board.
