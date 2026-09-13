# Burn Buds — Extensibility Contract

Status: active architecture requirement
Applies to: `games/protect-the-plants/` and `site/public-route-patch/games/protect-the-plants/`

## Principle

Burn Buds must remain expandable throughout development and after release. New features, tools, assets, audio, reactions, visual themes, game modes, telemetry, accessibility improvements, and presentation systems must be addable without rewriting the authoritative multiplayer core or creating another compatibility-breaking backend.

## Architectural rules

1. Keep authoritative match state isolated from presentation systems.
2. New player-facing features register through documented extension points rather than modifying unrelated modules.
3. Every optional feature has a stable ID, version, status, dependencies, and runtime hook list.
4. Features that affect authoritative gameplay must declare server requirements explicitly; presentation-only features must not mutate authoritative state.
5. Feature flags must allow new systems to be disabled independently when necessary.
6. Assets are data, not hard-coded assumptions. New assets register through manifests and can replace older assets without changing game-state logic.
7. Audio, animation, notifications, social reactions, UI panels, and visual themes must use shared registries or event hooks instead of bespoke DOM observers.
8. Mobile, tablet, and desktop applicability must be explicit for any new UI feature.
9. New additions must preserve keyboard access, reduced motion, touch usability, reconnect/recovery, and existing room compatibility.
10. No arbitrary caps on the number of future assets, reactions, audio cues, themes, presentation modules, or optional tools.

## Extension classes

### Core-compatible gameplay extension
Examples: turn timer, alternate room rules, practice mode, additional statistics.
Must declare whether PHP/API changes are required and include deterministic server/state tests.

### Presentation extension
Examples: new battlefield theme, formation skin, combat FX, result animation.
May listen to game events but must not become an alternative source of match truth.

### Social extension
Examples: quick reactions, enhanced chat, presence display, rematch tools.
Must preserve authentication, room privacy, and reconnect behavior.

### Tool extension
Examples: tutorial, practice targeting, accessibility settings, diagnostics/debug overlay.
Must remain separable from normal match flow.

### Content/asset extension
Examples: new logos, music, SFX, UI icons, environment art, seasonal themes.
Must be registered in the asset manifest with Drive and runtime destinations.

## Runtime event surface

Presentation modules should consume stable semantic events rather than scrape DOM state. Target event families:

- `session:restored`
- `room:created`
- `room:joined`
- `room:opponent-joined`
- `room:opponent-left`
- `network:offline`
- `network:reconnected`
- `placement:selected`
- `placement:valid`
- `placement:invalid`
- `placement:locked`
- `turn:started`
- `target:armed`
- `shot:fired`
- `shot:hit`
- `shot:miss`
- `formation:burned`
- `match:won`
- `match:lost`
- `chat:message`
- `reaction:sent`
- `rematch:requested`
- `rematch:started`

The premium rebuild should progressively move existing presentation code toward these semantic hooks.

## Feature registry

Machine-readable extension metadata lives at:

`games/protect-the-plants/extensions/registry.json`

Each registered feature records:

- `id`
- `version`
- `status`
- `category`
- `enabledByDefault`
- `serverAuthoritative`
- `dependencies`
- `hooks`
- `assetFamilies`
- `deviceScope`
- `notes`

The registry is intentionally open-ended. Adding a future feature should usually mean adding a module + manifest entry + tests, not editing unrelated legacy layers.

## Asset extensibility

Approved masters remain in Google Drive `Burn Buds / 08 Visual Assets`.
Runtime exports migrate toward `site/public-route-patch/games/protect-the-plants/assets/`.

Asset families must be additive. BB-001 through BB-010 are the initial production baseline, not a permanent ceiling. Future families use the next available identifiers (for example BB-011, BB-012) and are recorded in the asset manifest.

## Backward compatibility

The route `/games/protect-the-plants/`, active room identity, saved session compatibility, and server-authoritative match rules remain stable unless a deliberate migration is designed and tested. New presentation and optional feature systems must fail soft: disabling or missing an optional extension must not corrupt a room or prevent recovery.

## Definition of extensible

The architecture passes this requirement when a new visual theme, reaction pack, sound cue set, UI panel, or optional game tool can be introduced by registering its feature/assets and wiring documented hooks without modifying the core turn/room state machinery.