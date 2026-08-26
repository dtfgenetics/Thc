# Protect the Plants

Protect the Plants is DTF Genetics' original 15×15 two-player hidden-garden strategy game.

## Production target

- Canonical public route: `https://dtfseeds.com/games/protect-the-plants/`
- Front end: static HTML/CSS/vanilla JavaScript
- Multiplayer API: same-origin PHP (`api.php`)
- Production persistence: WordPress transients loaded through the site's `wp-load.php`
- Local/test persistence: temporary JSON fallback when WordPress is unavailable

## Gameplay

Players hide five potted-plant formations, then alternate scouting opponent plots. The server validates placement, turns, duplicate shots, hit/miss results, formation losses, and victory. Opponent formation locations remain hidden until a full formation is found or the game ends.

## Included UX

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
php -l site/public-route-patch/games/protect-the-plants/api.php
```

The PHP API has also been smoke-tested locally through create → join → both placements → state privacy → chat → alternating hit/miss → active-game lookup.
