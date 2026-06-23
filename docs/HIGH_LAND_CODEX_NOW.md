# HIGH LAND Current Codex Directive

This is the active execution checklist for HIGH LAND: The Sweet Escape.

Codex must read this file and `docs/HIGH_LAND_VISUAL_QUALITY_SPEC.md` before making changes.

## Core correction

The game cannot be only technically functional. It must be visually acceptable as a polished adult fantasy board game.

Bad generated output is not acceptable even if tests pass.

## Mandatory visual spec

Follow:

- `docs/HIGH_LAND_VISUAL_QUALITY_SPEC.md`

That file controls board art quality, location order, road/path rules, UI quality, and visual rejection criteria.

## Product scope

Build only HIGH LAND. Do not mix in High IQ, Weedopolis, Strain Showdown, Bud or Bluff, THC U Know, strain-card content, Monopoly content, prices, or unrelated assets.

## Locked game requirements

- Route: `/games/high-land/`
- Adult 21+ fantasy board game
- Local play: 1 to 10 players
- Online invite play: 2 to 10 players
- Players can name themselves
- Invite links use `?game=` room codes
- Dice movement equals exact spaces moved
- Tokens sit on board coordinates, not side panels
- Tokens animate through each path index
- Board has 111 ordered path spaces
- Board has 25 gameplay HIT trigger spaces
- Landing on a HIT space draws a HIT card
- HIT card effects apply immediately
- HIT cards sync across online players
- First player to reach Cloud 9 Citadel wins

## Locked location order

1. Rolling Hills
2. Dankwood Forest
3. Rosin Rail Station
4. Munchie Mountain
5. Kief Caves
6. Trichome Towers
7. Cloud 9 Citadel

## Required HIT handling

- Keep `actionSpaceIndexes` as the source of truth for 25 HIT triggers.
- The visual board must show all 25 gameplay HIT spaces.
- The test suite must fail if only the old four HIT labels trigger cards.
- Landing on every gameplay HIT trigger must draw a card.

## Required UI/art handling

The board must be the visual hero. Do not ship flat placeholder UI.

Required feel:

- colorful Candy Land-style path
- thick white road/space edging
- fantasy cannabis world behind the path
- strong depth, glow, smoke, candy color, cloud/resin/trichome effects
- readable mobile and desktop controls
- large player names and dice display
- polished card reveal modal

Reject and redo if the output looks generic, flat, empty, disconnected, or off-brand.

## Required validation commands

From the repo root:

```bash
npm ci
npm run test:high-land
npm run build:high-land
```

From the High Land app folder:

```bash
cd apps/high-land-web
npm test
npm run build
npm run test:e2e
```

## CI requirements

- The High Land build workflow must compile and test without depending on Datadog.
- Datadog synthetic tests must be skipped cleanly when `DD_API_KEY` or `DD_APP_KEY` is missing.
- Missing Datadog secrets are not a code failure.

## Completion definition

Work is not complete until:

- mechanics pass unit tests
- production build passes
- invite flow is manually/browser verified
- tokens visibly sit on the board
- all 25 HIT spaces are visible and functional
- visual output passes `HIGH_LAND_VISUAL_QUALITY_SPEC.md`
