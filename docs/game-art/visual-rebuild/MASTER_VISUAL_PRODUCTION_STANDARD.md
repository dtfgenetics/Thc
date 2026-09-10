# DTFSeeds Master Game Visual Production Standard

Status: ACTIVE
Updated: 2026-09-09

## Goal

Every DTFSeeds game must present a coherent game world or game table before it presents controls. The player should understand the fantasy, focal point, primary action, current state, and next meaningful choice within seconds.

The standard applies to phones, tablets, laptops, desktops, and large screens. Responsive design means **recomposition**, not shrinking a desktop screenshot.

## 1. Visual architecture

Use three layers where practical:

1. **Playfield / world** — canvas, Phaser, WebGL, SVG, or a master board surface.
2. **Game UI** — DOM HUD, menus, dialogs, score, lobby, accessibility controls.
3. **Site shell** — DTFSeeds navigation outside the critical play surface.

Keep simulation state independent of artwork. Reference runtime assets through stable manifest keys rather than hard-coded filenames.

## 2. Device composition system

Breakpoints are content-driven, but every title must be explicitly reviewed in these classes:

- **Small phone portrait:** roughly 320–479 CSS px wide.
- **Large phone portrait:** roughly 480–599 CSS px wide.
- **Phone landscape / small tablet:** short-height layouts around 568–926 CSS px wide.
- **Tablet portrait:** roughly 600–899 CSS px wide.
- **Tablet landscape / small laptop:** roughly 900–1199 CSS px wide.
- **Desktop:** roughly 1200–1599 CSS px wide.
- **Large desktop:** 1600 CSS px and above.

QA reference viewports: 360×800, 390×844, 412×915, 768×1024, 1024×768, 1366×768, 1440×900, and 1920×1080.

### Phone rules

- One dominant gameplay region.
- Collapse secondary logs, lore, rules, inventories, source notes, and chat into drawers/sheets unless they are essential to the current action.
- Primary touch controls should generally target 44–48 CSS px or larger even though WCAG 2.2's formal minimum target-size criterion is smaller.
- Avoid horizontal scrolling for normal gameplay UI.
- Respect `env(safe-area-inset-*)` for cutouts and browser chrome.
- Provide portrait layouts for board/card/puzzle games. Action games may prefer landscape, but should still provide a usable rotation/onboarding state instead of rendering broken UI.

### Tablet rules

- Do not simply scale the phone interface up.
- Use the extra space for secondary context: hand/deck, minimap, score detail, journal, opponent state, or tool tray.
- Support both portrait and landscape where the game loop permits it.
- Keep touch targets generous even when more information is visible.

### Desktop rules

- Protect the playfield; do not surround it with equal-weight panels.
- Use hover only as enhancement; critical actions must work without hover.
- Keyboard shortcuts/gamepad may supplement pointer controls.
- Use extra width for contextual secondary information, not permanent clutter.

### Large desktop rules

- Cap text line lengths and HUD growth.
- Expand the playfield or environmental framing rather than stretching every control.
- Preserve the intended composition with max-width/max-height rules where necessary.

## 3. Responsive art masters

Every title should have, where applicable:

- **16:9 landscape key art master:** 3840×2160.
- **9:16 portrait/mobile key art master:** 2160×3840 or a separately composed portrait piece.
- **1:1 hub/social master:** 2048×2048.
- **16:9 gameplay/background master:** 3840×2160 with a documented mobile-safe region.
- Optional ultrawide extension layers rather than stretching central art.

Runtime exports should be generated at device-appropriate resolutions. Do not ship full-resolution source masters when smaller responsive variants are sufficient.

## 4. 2D character and object pipeline

For animated 2D characters:

- Approve one canonical in-game seed frame first.
- Generate a complete animation strip in one coherent pass whenever possible.
- Normalize frames to one scale and one anchor, usually bottom-center.
- Keep transparency.
- Preview the strip in-engine before indexing it into the runtime manifest.

Typical action set: idle, walk/run, jump/fall, attack/use, hit, KO/death, celebrate, and game-specific abilities.

Use packed texture atlases/spritesheets for runtime delivery where they reduce requests and simplify animation indexing.

## 5. Board/card/puzzle pipeline

Board and card games should use a **master play surface** as the visual authority, similar to the successful Weedopolis principle: art establishes the world; interactive overlays handle state.

Separate:

- source card/frame masters;
- icons and emblems;
- runtime fronts/backs;
- selected/disabled/correct/damaged/etc. states;
- print masters when physical output is intended.

Do not bake dynamic score, rules, player names, question text, or translated text into raster art.

## 6. 3D pipeline

Use 3D only when spatial exploration, combat, or world presence materially improves the game. Browser shipping defaults to glTF/GLB. Optimize meshes, materials, draw calls, and textures; use compressed texture formats such as KTX2/Basis when supported.

Source DCC files stay separate from browser builds. Define scale, origins, pivots, collision proxies, LOD policy, skeleton naming, and animation clip names before producing a large asset set.

## 7. Runtime formats

Preferred delivery:

- SVG for logos, flat UI vectors, simple icons where appropriate.
- WebP or AVIF for opaque/photographic/painted raster images when browser support and workflow permit.
- Transparent WebP or PNG for alpha assets where needed.
- Spritesheets/atlases for animated 2D gameplay assets.
- WOFF2 for licensed web fonts.
- GLB/glTF 2.0 for browser 3D.

Source masters may remain PNG/PSD/SVG/BLEND or another editable format; runtime exports are separate deliverables.

## 8. UI state set

Every interactive control family must define: default, hover/focus, pressed, selected, disabled, success/correct, warning, error/incorrect, and loading/busy where applicable. Color must not be the only state signal.

Each game requires title/menu, pause/settings, active gameplay, win/results, loss/retry where applicable, reconnect/error where networked, and loading/progress presentation.

## 9. VFX and motion

Strong motion is reserved for state change, danger, reward, impact, reveal, and onboarding. Avoid ambient motion that competes with questions, cards, aiming, or reading. Respect reduced-motion preferences for nonessential animation.

## 10. Audio asset families

Each brief should classify music, ambience, UI SFX, gameplay SFX, announcer/NPC voice, and accessibility cues. Audio must support independent master/music/SFX control when the game uses substantial sound.

## 11. Asset manifest fields

Every production asset record should include:

- stable asset ID;
- game ID;
- category;
- purpose/state;
- source-master path;
- runtime path(s);
- aspect ratio or frame dimensions;
- alpha requirement;
- anchor/pivot if animated;
- device variants;
- load phase (initial / lazy / level / results);
- provenance/license note;
- approval status;
- revision/hash.

## 12. Performance targets

Treat these as starting budgets, not excuses to reduce quality:

- UI/puzzle/card titles: aim for a small initial visual payload, commonly under ~3–4 MB before audio, then lazy-load optional art.
- 2D action/RPG titles: keep the first playable chunk lean, commonly under ~6–8 MB before audio, then stream/lazy-load later worlds.
- 3D titles: aggressively optimize the initial environment and defer later areas; track texture memory and largest GLBs explicitly.

Serve smaller responsive images to narrow screens where possible.

## 13. First approval package for every game

Before mass production, create:

1. logo/title treatment;
2. 16:9 key art;
3. desktop active-game mockup at 1440×900;
4. phone active-game mockup at 390×844 (or landscape equivalent for action games);
5. tablet active-game mockup at 768×1024 or 1024×768;
6. core UI state strip;
7. representative character/card/object set;
8. one reward/win state;
9. one failure/danger state;
10. asset-manifest draft.

Mass asset generation begins only after this package reads as the intended game at actual gameplay scale.