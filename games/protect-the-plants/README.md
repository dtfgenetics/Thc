# Burn Buds

Burn Buds is DTF Genetics' 15×15 two-player hidden-fleet strategy game. It is the production evolution of the earlier **Protect the Plants** build and deliberately keeps the proven multiplayer API and legacy route so existing rooms, bookmarks, deployment automation, and recovery links are not broken during the rename.

## Production target

- Current canonical compatibility route: `https://dtfseeds.com/games/protect-the-plants/`
- Public product name: **Burn Buds**
- Front end: static HTML/CSS/vanilla JavaScript
- Multiplayer API: same-origin PHP (`api.php`)
- Production persistence: WordPress transients loaded through the site's `wp-load.php`
- Local/test persistence: temporary JSON fallback when WordPress is unavailable
- External paid services required: none

A dedicated `/games/burn-buds/` route can be introduced after the compatibility redirect/deployment rules are updated and verified. The working game is not being duplicated into a second backend.

## Gameplay

Players hide five cannabis-leaf formations, then alternate firing on opponent plots. The server validates placement, turns, duplicate shots, hit/miss results, formation losses, victory, rematch consent, and round resets. Opponent formation locations remain hidden until a full formation is burned or the round ends.

## Burn Buds production improvements

- cannabis-leaf fleet markers replace the old potted-plant pieces
- user-facing game identity changed to Burn Buds without changing multiplayer IDs
- animated burn treatment when a full formation is lost
- Burn Buds invite/result sharing layer
- cache version bumped so returning players receive the new game assets
- existing room codes and active-game recovery remain compatible

## Multiplayer/UX retained

- generated Web Audio effects for placement, hits, misses, lost formations, turns, wins, and losses
- optional device haptics using the native Vibration API
- placement footprint previews with valid/invalid feedback
- Undo and Clear placement controls
- keyboard placement shortcuts and arrow-key board navigation
- live coordinate readout while aiming or placing
- optional two-tap firing confirmation for mobile mis-tap protection
- Web Share support with clipboard fallback
- fullscreen play where the browser supports it
- live/reconnecting/offline connection indicator
- persisted server-side battle event history so the log survives refresh/reconnect
- finished-match recovery from the lobby
- two-player rematch consent and automatic round reset
- alternating first player between rematch rounds
- room codes and copyable invite links
- View Active Game recovery
- per-room text chat
- strong turn indicator
- mobile board tabs
- post-game hit/shot statistics
- reduced-motion support

## Verification

Run:

```bash
node --check site/public-route-patch/games/protect-the-plants/app.js
node --check site/public-route-patch/games/protect-the-plants/enhancements.js
node --check site/public-route-patch/games/protect-the-plants/v2-extras.js
node --check site/public-route-patch/games/protect-the-plants/burn-buds-branding.js
node --check site/public-route-patch/games/protect-the-plants/sw.js
php -l site/public-route-patch/games/protect-the-plants/api.php
```

The underlying V2 PHP API has already been smoke-tested through create → join → both placements → alternating turns → persisted match events → finished-game active recovery → two-party rematch → clean round-two reset. The Burn Buds work intentionally changes presentation, fleet visuals, and burn feedback without changing that server contract.
