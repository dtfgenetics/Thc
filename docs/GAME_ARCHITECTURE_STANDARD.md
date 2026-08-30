# DTFSeeds browser game architecture standard

Production target: **https://dtfseeds.com**

This standard keeps game development additive. New gameplay code should be able to grow without forcing a rewrite of routing, deployment, rendering, or shared site integration.

Player-facing visual quality is defined separately in **`docs/GAME_UI_STANDARD.md`**. Architecture and UI standards are both required for new locally owned public games: this document defines ownership boundaries; the UI standard defines playfield hierarchy, responsive HUD behavior, touch controls, visual polish, and rendered-browser QA.

## Non-negotiable boundaries

For new locally owned browser games, keep these concerns separate:

1. **Simulation/state** owns turns, entities, rules, timers, scores, win/loss state, progression, and anything that must be saved or synchronized.
2. **Renderer** turns state into visuals. It must not be the source of truth for game rules.
3. **Input mapping** converts keyboard, pointer, touch, and controller input into named game actions.
4. **UI/HUD** owns menus, settings, dialogs, text-heavy overlays, and accessible controls.
5. **Assets** are addressed by stable manifest keys instead of hard-coded file names throughout gameplay code.
6. **Data** is machine-readable content such as decks, levels, questions, encounters, balance tables, and configuration.
7. **Tests** verify deterministic rules and the smallest reliable browser/runtime contract.

This lets art, UI, rules, and content evolve independently.

## Standard local layout

New games created with `npm run games:new -- <id> "Title"` use this shape:

```text
games/<id>/
  README.md
  game.json
  src/
    main.mjs
    input.mjs
    simulation/
      state.mjs
    render/
      README.md
    ui/
      README.md
      game-ui.css
    assets/
      manifest.json
  data/
  test/
    smoke.test.mjs
  docs/
    ARCHITECTURE.md
```

The scaffold is deliberately non-deployable. The visitor runtime is added only when a usable build exists. Its starter UI theme is also deliberately neutral: use it as a structural baseline, then give the real game a distinct art/material direction before release.

## Source-of-truth and deployment

Do not create a second implementation just to make a game appear on the website.

- `data/project-registry.json` assigns canonical repository ownership.
- `games/<id>/` or `apps/<id>/` contains canonical source for games owned by `dtfgenetics/Thc`.
- `site/public-route-patch/games/<id>/` is a deployable visitor runtime, not a competing source tree.
- `site/deployment/public-apps.json` is the dtfseeds.com route/runtime/build contract.
- Standalone game repositories remain canonical when the project registry assigns them there.

When a public runtime contains generated/copied game data, update it through a deterministic build or sync step and test that it matches canonical data.

## State contract

Simulation state must be serializable data: plain objects, arrays, strings, numbers, booleans, and explicit IDs. Do not store DOM nodes, Canvas contexts, audio objects, timers, sockets, or renderer instances inside saveable game state.

Prefer a reducer-style boundary:

```js
const nextState = reduceGameState(previousState, action);
```

This makes local play, multiplayer authority, replays, tests, and save/load features easier to add later.

## Input contract

Gameplay code should consume actions such as:

- `move-left`
- `move-right`
- `move-up`
- `move-down`
- `confirm`
- `cancel`
- `ability-1`
- `pause`

Keyboard/touch/controller bindings belong in the input layer. Game rules should not contain checks such as `event.key === 'ArrowLeft'`.

## Asset contract

Use `src/assets/manifest.json` as the stable key layer for new games. Group assets by domain:

- `characters`
- `environment`
- `ui`
- `audio`
- `fx`

Runtime code asks for a key; the manifest decides which file satisfies that key. This prevents asset renames from spreading through gameplay logic.

## Browser/UI contract

Use the canvas/WebGL surface for the playfield when appropriate. Prefer DOM UI for menus, instructions, lobby controls, settings, forms, chat, and accessibility-sensitive text.

Every public game must remain usable on mobile-width layouts and must not trap page scrolling/zooming except while the user is actively interacting with the playfield.

New `dtf-browser-game-v1` scaffolds also declare `uiStandard: "dtf-game-ui-v1"` and include `src/ui/game-ui.css`. The starter CSS provides structural primitives for a playfield-first layout, compact HUD, touch-safe actions, safe-area handling, and reduced-motion support. Those primitives are not a finished art direction; replace the neutral theme with a game-specific visual system while preserving the behavior contract from `docs/GAME_UI_STANDARD.md`.

## Multiplayer contract

For multiplayer games, the server owns hidden information, turn legality, scoring, room membership, and authoritative state transitions. Clients send intents and render server-approved state.

Do not trust client-submitted scores, hidden boards, deck order, inventory, or win claims.

## Release contract

Before a new local game can be presented as playable on dtfseeds.com:

1. Ownership is registered in `data/project-registry.json`.
2. `game.json` identifies the implementation and release gates.
3. Deterministic rules/data tests pass.
4. The visitor runtime exists and works without broken asset paths.
5. Mobile interaction is checked.
6. Accessibility-sensitive controls/text are reviewed.
7. Art used in production is cleared/original.
8. The UI has a game-specific visual system and passes `docs/GAME_UI_STANDARD.md` browser QA; new scaffolds track this with `visualPolishReviewed` and `responsiveHudTested`.
9. `site/deployment/public-apps.json` has a unique route and concrete verification/build command.
10. `npm run games:preflight` passes.
11. Production is deployed from `main` and the live route is verified afterward.

## Existing games

Existing games are not required to be rewritten into this structure immediately. The workspace verifier keeps schema-v1 manifests compatible. When an older game receives a meaningful architecture refactor, migrate it to the current scaffold contract as part of that game-specific change rather than mixing a mass migration into unrelated gameplay work.

For UI modernization, preserve working gameplay/state first and migrate the presentation layer game-by-game using `docs/GAME_UI_STANDARD.md`. High Land is the current reference for that approach.
