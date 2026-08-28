# Cannabis Fleet Battle — merged into Burn Buds

This repository folder contains an earlier server-engine scaffold for the same 15×15 hidden-fleet concept that is now shipped as **Burn Buds**.

## Canonical game

- Public product: **Burn Buds**
- Canonical implementation metadata: `games/protect-the-plants/game.json`
- Browser runtime: `site/public-route-patch/games/protect-the-plants/`
- Production compatibility route: `https://dtfseeds.com/games/protect-the-plants/`
- Board: 15×15
- Players: 2
- Fleet presentation: cannabis-leaf formations
- Multiplayer: same-origin PHP with server-authoritative turns and hidden opponent state
- Persistence: WordPress transients in production
- Existing features: room codes, invite sharing, active-game recovery, room chat, reconnect handling, mobile board tabs, burn animations, rematches, sound/haptics, and post-game statistics

## Why this folder remains

The engine and protocol files here are retained as design/test history. They should **not** become a second public Battleship implementation. New browser gameplay, branding, multiplayer UX, deployment, and production work belongs in Burn Buds so the project keeps one source of truth.

Useful concepts from this scaffold may be ported into Burn Buds only when they improve the canonical implementation and preserve its tested PHP multiplayer contract.
