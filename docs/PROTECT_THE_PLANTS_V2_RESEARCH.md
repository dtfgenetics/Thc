# Protect the Plants V2 — Free Feature Research

This pass reviewed public/open Battleship-style projects for gameplay and UX ideas. The implementation in Protect the Plants does **not** copy third-party source code. It uses the ideas as reference and implements the selected features with browser-native JavaScript, CSS, Web APIs, and the existing PHP/WordPress backend.

## Public references reviewed

- `jernestmyers/battleship` — useful ideas: placement preview/drag interaction, random placement, sunk-ship reveal, improved placement UX.
- `kbennett2000/lan-games` — useful ideas: save/resume, room chat, spectator/reconnect concepts, action history, hidden-information enforcement on the server.
- `robert-kratz/battleship-game` — useful ideas: private rooms, configurable match rules, turn timers, energy/special actions.
- `tigrino/navy-fleet-battle` — useful idea: sequence visual and sound feedback from the same game event so audio never reveals the outcome early.
- `khanmjk/firebaseStudio-batteshipgame` — useful ideas: clear board cell states, coordinate labeling, placement interaction, sunk-state animation.

## V2 features implemented natively

- placement footprint preview with valid/invalid state
- placement undo and clear
- keyboard placement shortcuts and arrow-key board navigation
- coordinate readout while aiming or placing
- generated Web Audio sound effects (no audio assets or package dependency)
- optional native device vibration feedback
- optional two-tap shot confirmation for mobile
- Web Share API with clipboard fallback
- fullscreen support
- live / reconnecting / offline status indicator
- persistent server-side battle event history
- finished-match recovery through View Active Game
- two-player rematch consent
- clean round reset while retaining both authenticated players
- alternating first player across rematch rounds
- game settings/help dialog stored locally per browser

## Strong free candidates for later passes

These were not added in V2 because they change the server/game rules more substantially and deserve isolated testing:

1. **Safe spectator mode** — spectators receive only public information, never hidden formations.
2. **Timed-turn mode** — server-authoritative turn deadline with configurable casual/competitive presets.
3. **Practice AI** — deterministic hunt/target AI for solo practice, implemented locally with no cloud AI cost.
4. **Optional special-action mode** — limited radar/area-scout actions with server validation and explicit lobby opt-in.
5. **Match series** — best-of-3 / best-of-5 scoring across rematch rounds.
6. **Presence/reconnect state** — last-seen indicators without writing WordPress transient state every polling tick.
7. **Spectator-safe replay** — replay completed rounds from persisted event history after hidden information is fully revealed.

## Architecture rule

Protect the Plants remains deployable on the existing DTFSeeds WordPress/PHP path. V2 adds no paid runtime services, no Node server requirement, and no external JavaScript packages.
