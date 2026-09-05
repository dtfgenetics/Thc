# Burn Buds

Burn Buds is DTF Genetics' production-ready 15×15 two-player hidden-fleet strategy game. The earlier Protect the Plants name is retained only as a legacy compatibility identifier for the existing route, active rooms, recovery links, persistence, and deployment wiring.

## Production identity

- Public product name: **Burn Buds**
- Compatibility route: `https://dtfseeds.com/games/protect-the-plants/`
- Front end: static HTML/CSS/vanilla JavaScript
- Multiplayer API: same-origin PHP (`api.php`)
- Production persistence: WordPress transients
- External paid runtime dependencies: none
- Release status: **production-ready**

Do not create a second multiplayer backend for a vanity route. Any future `/games/burn-buds/` URL should redirect or alias to the same canonical runtime so rooms and recovery remain compatible.

## Core gameplay

Players hide five cannabis-leaf formations on a 15×15 stash grid, then alternate firing on the opponent grid. The server validates placement, turns, duplicate shots, hit/miss results, burned formations, victory, reconnect state, rematch consent, and round resets. Opponent locations stay hidden until each formation is fully burned or the round ends.

Formations: Mother Row (5), Trellis Row (4), Tall Pheno (3), Bushy Pheno (3), and Solo Pots (2).

## Production UX

- Burn Buds branding throughout the public UI
- cannabis-leaf fleet markers and formation-specific burn feedback
- placement preview, invalid feedback, random placement, rotate, Undo, and Clear
- desktop one-click targeting
- coarse-pointer/mobile tap-once-to-aim and tap-again-to-fire targeting
- keyboard board navigation and coordinate readouts
- strong hit/miss/latest-shot presentation
- turn-state banner and opponent presence
- generated Web Audio feedback and optional haptics
- room chat and quick-chat controls
- invite sharing with fallback
- network/reconnect status
- active-game and finished-game recovery
- persisted battle event history
- two-player rematch consent with alternating round starter
- post-game hit/shot statistics
- mobile board tabs and reduced-motion support

## Architecture

The PHP server is authoritative for multiplayer state. Gameplay helpers use the shared Burn Buds render-sync runtime instead of maintaining duplicate DOM observers. The retired `confirmShots` preference, armed-shot interceptor, and temporary targeting-policy shim have been removed. `targeting-v1.js` is the sole authoritative coarse-pointer two-tap firing path, and the current service-worker shell identifies the native-targeting release.

## Production verification

The compatibility-named workflow `.github/workflows/verify-protect-the-plants-production.yml` is the **Verify Burn Buds Production** workflow. It runs after the DTFSeeds Public Suite WordPress deployment succeeds and verifies the deployed game rather than racing the deployment.

It checks the live Burn Buds shell and manifest, current production assets, create/join/authenticated state, placement, room chat, full victory, finished-game recovery, two-party rematch, round-two reset, desktop one-click firing, mobile two-tap aim/fire, keyboard navigation, mobile overflow, and browser console/page errors.
