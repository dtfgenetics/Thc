# Protect the Plants

Protect the Plants is DTF Genetics' original 15×15 two-player hidden-garden strategy game.

## Production target

- Canonical public route: `https://dtfseeds.com/games/protect-the-plants/`
- Front end: static HTML/CSS/vanilla JavaScript
- Multiplayer API: same-origin PHP (`api.php`)
- Production persistence: WordPress transients loaded through the site's `wp-load.php`
- Local/test persistence: temporary JSON fallback when WordPress is unavailable
- External paid services required: none

## Gameplay

Players hide five potted-plant formations, then alternate scouting opponent plots. The server validates placement, turns, duplicate shots, hit/miss results, formation losses, victory, rematch consent, and round resets. Opponent formation locations remain hidden until a full formation is found or the round ends.

## V2 quality improvements

The V2 improvement layer keeps the existing WordPress/PHP architecture and adds higher-quality browser-game behavior without paid services or runtime packages:

- generated Web Audio sound effects for placement, hits, misses, lost formations, turns, wins, and losses
- optional device haptics using the native Vibration API
- placement footprint previews with valid/invalid feedback
- Undo and Clear placement controls
- keyboard placement shortcuts and arrow-key board navigation
- live coordinate readout while aiming or placing
- optional two-tap scouting confirmation for mobile mis-tap protection
- Web Share support with clipboard fallback
- fullscreen play where the browser supports it
- live/reconnecting/offline connection indicator
- persisted server-side battle event history so the log survives refresh/reconnect
- finished-match recovery from the lobby
- two-player rematch consent and automatic round reset
- alternating first player between rematch rounds
- game settings/help dialog stored locally per browser

## Existing UX retained

- animated potted plants during placement
- manual and randomized placement
- rotate placement direction
- room codes and copyable invite links
- View Active Game recovery
- per-room text chat
- strong turn indicator
- mobile board tabs
- plant-loss animation
- post-game hit/shot statistics
- reduced-motion support

## Verification

Run:

```bash
node --check site/public-route-patch/games/protect-the-plants/app.js
node --check site/public-route-patch/games/protect-the-plants/enhancements.js
php -l site/public-route-patch/games/protect-the-plants/api.php
```

The V2 PHP API has been smoke-tested through create → join → both placements → alternating turns → 35 persisted match events → finished-game active recovery → first rematch request → second rematch acceptance → clean round-two placement reset.
