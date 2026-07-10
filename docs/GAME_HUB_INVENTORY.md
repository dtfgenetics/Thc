# DTF Game Hub Inventory

This inventory is based on the repositories currently owned by `dtfgenetics`. It separates playable code from design-only projects so the hub does not advertise unfinished titles as live games.

## Tier 1 — playable or near-deployable online games

### High Land: The Sweet Escape

**Repository:** `dtfgenetics/Thc`

**Current state:** Playable React/Vite/Phaser board game with local room simulation, a shared-hosting PHP room API, tests and a separate Node/Colyseus scaffold.

**Hub treatment:** First migration pilot. Keep the current WordPress build available while the authoritative API and staging deployment are verified.

**Do not:** Copy the client-authoritative PHP update model into the new hub.

### Kush Kings Chess / THC Chess

**Repository:** `dtfgenetics/Thc-chess-git`

**Current state:** A separate Next.js, Express, Socket.IO and PostgreSQL multiplayer application with legal chess validation, rooms, spectators, chat and archives.

**Hub treatment:** Integrate as a separate deployed game behind a hub card and shared navigation. Do not replace its chess engine or force it into High Land's turn engine.

**Needed later:** Shared identity/branding bridge, health monitoring, consistent return-to-hub navigation and deployment review.

### THC U Know

**Repository:** `dtfgenetics/thc-u-know-card-game-`

**Current state:** React/Vite web app, Express/Socket.IO server, shared game-engine package and Discord bot scaffold. Designed for 2–8 player online rooms.

**Hub treatment:** Review its existing tests and server authority after High Land staging. Reuse hub identity and navigation, but preserve its shared package and realtime card-game protocol.

## Tier 2 — digital prototype needing online conversion

### Who Took It?

**Repository:** `dtfgenetics/Thc-guess-who`

**Current state:** React/Vite digital prototype with single-player, shared-mystery host mode and local two-player duel mode. Structured suspects, items and yes/no questions exist.

**Hub treatment:** Keep current local/single-player modes. Add online room state only after the High Land room/session service is proven.

**Multiplayer needs:** Hidden per-player state, server-selected mystery, legal question/answer flow, accusation validation and reconnect behavior.

## Tier 3 — structured game design, not yet a deployable digital game

### Weedopolis: Strain City Edition

**Repository:** `dtfgenetics/Weedopolis-strain-Edition`

**Current state:** Production bible and structured data for a locked 40-space property-trading board. The repository describes future digital implementation but is primarily a design and asset source of truth.

**Hub treatment:** Display as “In Development” only after an approved public preview exists. Build the digital rules engine from structured data rather than rasterizing the board as one uncontrolled image.

### PhenoQuest: The Living Seed Vault

**Repository:** `dtfgenetics/Catching-phenos`

**Current state:** Pre-production game bible and data-schema setup for a browser genetics creature-collection RPG.

**Hub treatment:** Do not schedule for multiplayer migration yet. First lock the MVP roster, cloning, breeding, expression and encounter systems.

### Terpocalypse: Grow Room From Hell

**Repository:** `dtfgenetics/Terpocalapse`

**Current state:** Asset planning and vertical-slice definition. No playable browser code is documented yet.

**Hub treatment:** Keep off the public playable catalog. A future vertical slice should use its own real-time simulation architecture rather than the turn-based room service.

### THC RPG

**Repository:** `dtfgenetics/Thc-rpg`

**Current state:** Repository metadata is too limited to define a production plan safely.

**Hub treatment:** Require a project brief, rules, technical stack and playable milestone before integration work.

### Ganjumanji: The Lost Grower's Temple

**Repository:** `dtfgenetics/GANJUMANJI-The-Lost-Grower-s-Temple`

**Current state:** Repository is effectively empty according to current repository metadata.

**Hub treatment:** Concept placeholder only.

## Not a game-hub title

### Happy Seed Stories / Seed Valley

**Repository:** `dtfgenetics/Happy-seed-story-s-`

This is a children's plant-science publishing system, not a cannabis game. It should remain under an educational/publishing brand and should not be mixed into the adult DTF game catalog.

## Hub release order

1. High Land authoritative multiplayer staging.
2. Hub shell with game catalog, status labels and shared navigation.
3. Link/integrate Kush Kings Chess without rewriting its engine.
4. Review and stage THC U Know.
5. Convert Who Took It? to online multiplayer.
6. Build Weedopolis only after its digital rules specification is locked.
7. Keep PhenoQuest, Terpocalypse, THC RPG and Ganjumanji in internal development until each has a playable vertical slice.

## Architectural conclusion

The hub should not use one gameplay engine for every title. It should share only platform capabilities:

- player identity
- game catalog
- invitations and deep links
- navigation
- profiles and achievements
- moderation
- analytics
- health monitoring
- deployment conventions

Each game keeps the engine appropriate to its genre:

- REST/polling for slower turn-based games
- Socket.IO or another realtime transport for chess and fast card games
- dedicated simulation networking for future action games
