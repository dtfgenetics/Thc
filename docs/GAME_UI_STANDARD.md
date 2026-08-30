# DTFSeeds browser game UI standard

Production target: **https://dtfseeds.com**

This standard defines the visible quality bar for DTF browser games. A game is not finished because the rules work. The player must understand what to do, reach the playable surface quickly, use it comfortably on a phone, and see a deliberate visual system rather than generic prototype chrome.

The architecture standard still owns simulation/render/input boundaries. This document owns the **player-facing interface**.

## Core principle: playfield first

A game screen should look like a game before it looks like an app.

For normal play:

- keep the center of the playfield clear;
- keep persistent HUD coverage low enough that the scene/board remains dominant;
- use one primary persistent HUD cluster and, when needed, one smaller secondary cluster;
- put rules, lore, diagnostics, settings, long control lists, and secondary data behind drawers, menus, or pause surfaces;
- use contextual prompts and transient feedback instead of permanent explanation panels;
- never surround the playfield with equal-weight dashboard cards on every edge.

As a target, the playfield should own roughly **75% or more of the useful desktop game area** whenever the game type allows it.

## Required UI layers

### 1. Entry / onboarding

The first screen must establish:

- game title and visual identity;
- one-sentence objective;
- primary way to start;
- multiplayer/local options when applicable;
- player identity or room setup only when required.

Do not make the player read the complete rules before play.

### 2. Primary HUD

Persistent HUD content is limited to information needed for the current decision:

- current player / turn;
- score, health, timer, resources, or position when relevant;
- objective or current phase;
- immediate status feedback.

HUD text should remain DOM-native and accessible even when the playfield uses Canvas/WebGL.

### 3. Primary action area

One action must read as the obvious next move.

Examples:

- Roll
- Draw
- Attack
- Confirm
- Submit answer
- End turn

Secondary actions should be visually quieter. Destructive actions must not compete with the primary action.

### 4. Secondary surfaces

Rules, settings, inventory detail, room management, tutorials, history, diagnostics, and long-form content should use:

- drawer;
- modal;
- collapsible panel;
- pause screen;
- dedicated pre/post-game screen.

Do not leave them expanded during normal play unless the game mechanic requires it.

### 5. Reward / danger / state-change surfaces

Strong motion and visual emphasis belong on meaningful events:

- win/loss;
- card reveal;
- damage/danger;
- checkpoint;
- reward;
- turn/phase transition.

Routine controls should not constantly animate.

## DTF game shell design system

Every modern local game should define CSS custom properties for at least:

- page/playfield background;
- primary surface;
- elevated surface;
- primary text;
- muted text;
- border;
- accent;
- success;
- warning;
- danger;
- small/medium/large radius;
- motion timing;
- touch-control minimum size.

The theme can change completely by game. The **system** should not.

Use shared component families/variants for repeated controls instead of one-off CSS copies.

## Visual quality rules

### Avoid generic AI/dashboard UI

Do not default to:

- a full-width app header plus rows of cards;
- large rounded boxes around every piece of information;
- bento grids unrelated to the game mechanic;
- permanent instruction paragraphs over a live playfield;
- pill-shaped everything;
- random neon gradients without a game-specific material/visual idea;
- identical card styling for status, rules, actions, players, settings, and results.

A game should have one clear material/visual language tied to its fantasy.

### Typography

Define deliberate sizes/weights for:

- game title;
- HUD value;
- HUD label;
- primary control;
- secondary control;
- dialog title;
- body/help text.

Do not rely on browser-default button/input typography.

### Icons

Use icons only when they improve recognition. Keep stroke/fill weight and optical size consistent across the game. Do not mix unrelated icon families.

### Art

Visible production gameplay art must be final-quality or intentionally stylized. Avoid placeholder geometric shapes when a character, object, tile, card, environment, or reward asset is supposed to carry the fantasy.

Keep collision/gameplay geometry in code; keep visible art in the asset system.

## Mobile contract

Mobile is part of the original design, not a later shrink pass.

Every public game must:

- avoid document-level horizontal overflow;
- keep primary touch targets at least **44 × 44 CSS px**;
- honor `env(safe-area-inset-*)` when controls can touch device edges;
- keep the primary action reachable without obscuring the playfield;
- switch wide HUDs to horizontal rails, compact stacks, or contextual surfaces before covering the board/scene;
- use fluid sizing (`min()`, `max()`, `clamp()`, percentages, aspect ratios) instead of fixed desktop widths;
- test at phone portrait and phone landscape sizes;
- allow page scrolling/zooming unless active playfield interaction genuinely requires capture.

For action-heavy mobile games, a sticky bottom action dock is preferred over a tall permanent sidebar.

## Desktop contract

Desktop layouts should use extra width for the playfield, not merely for more chrome.

Prefer:

- playfield + compact action rail;
- playfield + narrow contextual inspector;
- centered playfield + edge HUD;
- horizontal player/status rail.

Avoid two or three equally weighted app columns around the game.

## Motion and accessibility

- respect `prefers-reduced-motion` for non-essential animation;
- use `:focus-visible` states with strong contrast;
- maintain readable contrast over moving imagery;
- pause/gate camera or pointer-lock input while dialogs/settings are active;
- expose meaningful status changes through DOM/ARIA when Canvas/WebGL alone would hide them;
- do not use color as the only status signal.

## Responsive implementation pattern

Prefer a small number of meaningful breakpoints rather than device-specific CSS.

Typical behavior:

1. **Wide desktop:** playfield plus compact rail.
2. **Tablet/small desktop:** playfield then two-column controls.
3. **Phone:** playfield, compact status rail, sticky primary action area.
4. **Short landscape:** reduce HUD height and prioritize playfield vertical space.

## Visual QA contract

A production UI change is not complete until the rendered interface is exercised, not only compiled.

At minimum verify:

- entry screen at desktop width;
- active gameplay at desktop width;
- active gameplay at phone portrait width;
- phone landscape or short-height viewport when relevant;
- no document overflow;
- primary action target size;
- core interaction path;
- modal/drawer open and close behavior;
- long player names/content wrapping;
- maximum supported player/entity count where relevant;
- reduced-motion behavior for major animated surfaces.

Browser E2E tests should assert layout contracts that matter to gameplay, such as board dominance, compact HUD height, touch target size, and overflow safety. Do not encode pixel-perfect screenshots as the only test.

## Base44-style build loop for DTF code

Use the same discipline that makes strong AI builders feel polished while keeping the implementation owned by DTF:

1. define the game fantasy and primary player verb;
2. choose the visual/material direction;
3. define theme tokens and component families;
4. build the complete primary game screen, not only a hero/menu;
5. implement responsive states at the same time;
6. run the game in a browser and test the real interaction path;
7. inspect desktop and mobile presentation;
8. repair hierarchy, overflow, typography, spacing, controls, and art mismatches;
9. only then mark visual/mobile release gates complete.

## Migration order for existing games

Do not mass-rewrite gameplay engines. Upgrade the UI layer around working rules.

For an existing game:

1. preserve gameplay state and stable test selectors;
2. identify the actual playfield and primary action;
3. remove/de-emphasize permanent secondary panels;
4. establish tokens and a game-specific material language;
5. compact the HUD;
6. add responsive action behavior;
7. add browser UI-contract tests;
8. ship that game independently before moving to the next one.

High Land is the reference migration for this pattern.
