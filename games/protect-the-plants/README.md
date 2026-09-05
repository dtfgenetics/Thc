# Burn Buds

Burn Buds is DTF Genetics' 15×15 two-player hidden-fleet strategy game. The earlier Protect the Plants name is retained only as a legacy compatibility identifier for the existing route, room links, persistence, and deployment wiring.

## Production identity

- Public product name: **Burn Buds**
- Compatibility route: `https://dtfseeds.com/games/protect-the-plants/`
- Front end: static HTML/CSS/vanilla JavaScript
- Multiplayer API: same-origin PHP (`api.php`)
- Production persistence: WordPress transients
- External paid runtime dependencies: none
- Release status: **production-ready**

Do not create a second multiplayer backend for a `/games/burn-buds/` vanity route. If a new public URL is introduced later, redirect or alias it to the same canonical Burn Buds runtime so active rooms and recovery remain compatible.

## Core gameplay

Players hide five cannabis-leaf formations on a 15×15 stash grid, then alternate firing on the opponent grid. The server validates placement, turns, duplicate shots, hit/miss results, burned formations, victory, reconnect state, rematch consent, and round resets. Opponent formation locations stay hidden until each formation is fully burned or the round ends.

Formations:

- Mother Row — 5 cells
- Trellis Row — 4 cells
- Tall Pheno — 3 cells
- Bushy Pheno — 3 cells
- Solo Pots — 2 cells

## Production UX

- Burn Buds branding throughout the public UI
- cannabis-leaf fleet markers and formation-specific burn feedback
- placement preview, invalid-placement feedback, random placement, rotate, Undo, and Clear
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
- mobile board tabs
- reduced-motion support

## Architecture

The server remains authoritative for multiplayer state. Browser helpers subscribe to the shared Burn Buds render-sync runtime instead of independently observing the same game DOM where migrated. The legacy `confirmShots` preference is disabled; `targeting-v1.js` owns mobile two-tap confirmation.

## Production verification

The production verifier is `.github/workflows/verify-protect-the-plants-production.yml`; despite the compatibility filename, its workflow identity and assertions are **Burn Buds**. It runs after the DTFSeeds Public Suite WordPress deployment succeeds and verifies:

- live Burn Buds shell, manifest, and current cached assets
- two-player create/join/authenticated state
- placement and hidden-state multiplayer behavior
- room chat
- full victory flow
- finished-game recovery
- two-party rematch and round-two reset
- desktop one-click firing
- mobile two-tap aim/fire behavior
- keyboard board navigation
- mobile horizontal-overflow sanity
- browser console/page errors

Local contract checks include JavaScript syntax, PHP linting, branding, targeting, battle feedback, shared render sync, multiplayer compatibility, route integrity, release packaging, and Public Suite qualification.
