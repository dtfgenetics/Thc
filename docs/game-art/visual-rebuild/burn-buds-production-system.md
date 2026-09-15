# Burn Buds — Premium Production System

Status: active production contract
Canonical repo: `dtfgenetics/Thc`
Runtime route: `/games/protect-the-plants/`
Public product: **Burn Buds**
Drive root: `Burn Buds / 08 Visual Assets`

## Product rule

Burn Buds is not complete when its mechanics merely function. A release is acceptable only when the complete player experience is readable, responsive, visually authored, socially clear, and satisfying across phone, tablet, and desktop.

The existing server-authoritative 15×15 multiplayer runtime remains the gameplay foundation. The premium rebuild changes presentation, interaction flow, feedback, asset quality, and feature cohesion without forking room state or creating a second backend.

## Critical problems to solve

1. The current interface reads as layered web-app panels instead of a cohesive game.
2. The lobby exposes too many surfaces at once and weakens the primary host/join/resume flow.
3. Invite sharing lacks a dedicated waiting-room experience with clear room status and social actions.
4. Chat consumes layout space and should become a contextual drawer/bottom sheet with quick reactions.
5. The 15×15 board is mechanically correct but visually resembles a spreadsheet grid.
6. Mobile currently attempts to compress too much simultaneous information instead of using a mobile-first information hierarchy.
7. Hits, misses, burns, turn changes, victory, and defeat lack authored game-scale feedback.
8. Generated Web Audio is a useful fallback but is not final sound design.
9. Popups use generic toasts/dialogs rather than a severity-aware game notification system.
10. Branding and terminology are inconsistent between the legacy Protect the Plants compatibility route and the Burn Buds product identity.

## Experience hierarchy

### Lobby
Persistent information budget is intentionally low.

Primary actions:
- Host Battle
- Join Battle
- Resume Battle, only when an active match exists
- How to Play

Secondary material moves behind drawers or contextual surfaces.

### Waiting room
The host and join flow transitions to a dedicated room screen containing:
- room code
- copy code
- copy invite link
- native share
- QR-ready invite area
- player 1 and player 2 presence
- connection state
- chat/reactions
- clear waiting/ready transition

### Placement
The battlefield owns the viewport. Formation controls become a compact tray/drawer. Placement requires obvious selected, ghost, valid, invalid, rotate, undo, clear, randomize, and lock states.

### Battle
Desktop may use dual boards when space allows. Phone shows one board at a time with persistent `Garden / Enemy / Fleet / Chat` navigation and contextual fire confirmation. Supporting logs become drawers or transient event notifications.

## Premium system requirements

### Notifications
Four severity levels:
- utility toast: copied, settings saved, reconnecting
- battle toast: hit, miss, coordinate feedback
- major event banner: formation burned, opponent joined, rematch requested
- modal/result scene: disconnect requiring action, victory, defeat, round restart

### Social
- room chat
- collapsible desktop drawer
- mobile bottom sheet
- quick reactions
- system events visually separate from player messages
- reconnect/presence state

Suggested reactions:
`🔥 Burn!`, `🌱 Nice shot`, `💨 Missed me`, `👀 I see you`, `😈 You're cooked`, `🎯 Lucky shot`, `😂 No way`, `💀 RIP that plant`.

### Audio
Three-channel architecture:
- music
- SFX
- master/mute

Generated oscillator audio remains fallback-only. Authored production audio should cover lobby, placement, target lock, fire, miss, hit, burn, formation loss, turn change, join, reconnect, chat, victory, defeat, and rematch.

### Motion
Strong motion is reserved for state change, reward, danger, and onboarding. Reduced-motion must suppress non-essential animation.

Required motion moments:
- logo/scene entry
- opponent arrival
- formation pickup/ghost/snap
- invalid placement response
- target lock
- projectile/impact
- foliage shake
- smoke/ember burn sequence
- formation reveal/destruction
- board switch
- victory/defeat reveal

## Burn Buds language system

Use themed language selectively; do not turn every label into a joke.

Approved direction examples:
- lobby tagline: `Hide your buds. Burn theirs.`
- your turn: `Light 'em up.`
- hit: `SPARKED!`
- miss: `Up in smoke.`
- Mother Row destroyed: `YOUR MOTHER GOT BURNED`
- Trellis Row destroyed: `TRELLIS TORCHED`
- Tall Pheno destroyed: `PHENO FRIED`
- Bushy Pheno destroyed: `BUSH BURNED`
- Solo Pots destroyed: `SOLO POTS SMOKED`
- final win: `LAST BUD STANDING`

## Responsive contract

### Phone
- one board visible at a time
- minimum persistent chrome
- board remains primary visual surface
- bottom action rail: Garden / Enemy / Fleet / Chat
- fleet and chat open as bottom sheets
- targeting confirmation is explicit and large enough for touch
- no permanent battle log panel

### Tablet
- board + contextual tray, or two boards in landscape where dimensions permit
- chat collapses
- room/lobby surfaces reflow rather than simply shrink

### Desktop
- dual-board battle composition where useful
- compact persistent combat HUD
- optional collapsible chat drawer
- no dashboard-style wall of equal-weight cards

## Visual asset production batches

### BB-001 Battlefield Identity
Master garden battlefield, enemy variant, desktop dual-board composition, tablet composition, phone single-board composition, grid/soil language, fogged enemy treatment, finished representative gameplay scene.

### BB-002 Formation Fleet
Mother Row, Trellis Row, Tall Pheno, Bushy Pheno, Solo Pots. Design intact, selected, placement ghost, valid, invalid, damaged, burning, and destroyed states. Some states may be composited from base art + effects rather than independent raster files.

### BB-003 Combat FX
Targeting reticle, lock, shot, miss, impact, hit, ignition, flame, smoke, embers, scorch, damaged foliage, final burn, victory burst.

### BB-004 Placement UX
Formation tray, selected state, legal/illegal placement cues, rotate, undo, clear, random deployment, lock/ready state.

### BB-005 Battle HUD
Player/opponent banners, turn state, attack state, fleet status, room state, network/reconnect, coordinate/target readout, mobile board navigation.

### BB-006 Multiplayer Lobby
Host, join, resume, waiting room, room code, copy/share states, player slots, opponent arrival, chat/reaction treatment.

### BB-007 Results
Victory garden, burnout defeat scene, statistics, rematch, battle summary, round transition.

### BB-008 Brand Package
Primary logo, compact mark, app/icon treatment, loading screen, Game Hub cover, card thumbnail, social preview, landscape banner, mobile promotional art.

### BB-009 Audio Identity
UI, lobby, placement, combat, state-change, victory/defeat audio plus lobby/battle music loops.

### BB-010 Motion/Game Feel
Authored transitions and effect sequences for the major moments defined above.

## Drive-to-runtime rule

Approved source artwork lives in Google Drive `Burn Buds / 08 Visual Assets`.
Runtime-optimized exports live in the canonical Burn Buds runtime under `site/public-route-patch/games/protect-the-plants/` and should migrate toward a dedicated `assets/` tree.

Every approved asset must record:
- asset ID
- filename
- category
- dimensions/aspect ratio
- transparency requirement
- Drive destination
- runtime destination
- state/use case
- phone/tablet/desktop applicability
- approval status
- integration status

## Definition of premium complete

Burn Buds is visually complete only when:
- first-time players can host or join without instruction outside the UI
- invites resolve directly into the intended room flow
- phone, tablet, and desktop each have a deliberate composition
- no core screen resembles a generic dashboard or spreadsheet
- placement and targeting state are unmistakable
- hit/miss/burn/win/loss feedback is visually and audibly distinct
- chat and social tools remain available without obscuring the board
- all required BB-001 through BB-010 families are approved or explicitly documented as engine-generated
- runtime assets and Drive masters are mapped and traceable
- legacy Protect the Plants wording is limited to compatibility/internal identifiers
- deterministic Node/build/live-contract verification passes
