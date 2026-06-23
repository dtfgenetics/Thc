# HIGH LAND Visual Quality Spec

This file is the mandatory visual contract for **HIGH LAND: The Sweet Escape**. Code that technically works but looks flat, generic, misplaced, or off-brand is not acceptable.

## Non-negotiable goal

HIGH LAND must feel like a polished adult fantasy board game, not a placeholder web demo.

The product must combine:

- Candy Land-style path readability
- rich fantasy cannabis world art
- large clear board spaces
- visible gameplay HIT spaces
- tokens that live on the board
- readable mobile and desktop UI
- no broken layout, no generic flat background, no off-board tokens

## Approved world and location order

The board must play in this exact sequence:

1. START
2. Rolling Hills
3. Dankwood Forest
4. Rosin Rail Station
5. Munchie Mountain
6. Kief Caves
7. Trichome Towers
8. Cloud 9 Citadel
9. FINISH

Do not add, rename, remove, or reorder these locations.

## Location art requirements

Each zone must be visually obvious:

- **Rolling Hills**: rolling green hills with joints/rolled-paper imagery. Soft entry zone, bright and playful.
- **Dankwood Forest**: giant cannabis trees/plants, dense forest, large scale. Must not look like normal tiny shrubs.
- **Rosin Rail Station**: sticky amber/gold resin, rails, station cues, glossy rosin feel.
- **Munchie Mountain**: candy/food mountain, colorful snacks, playful edible/fantasy feeling.
- **Kief Caves**: cave system, dusty crystalline kief, sparkle/dust texture.
- **Trichome Towers**: crystalline towers, frosty trichome shapes, icy/resin sparkle.
- **Cloud 9 Citadel**: castle/citadel in clouds, grand finish-zone energy.

## Road/path rules

The path must be one continuous Candy Land-style road:

- No disconnected segments.
- No alternate routes.
- Every space must connect to the next space.
- Spaces must be large and readable.
- Thick white edging around the path/spaces.
- Colors must remain red, yellow, green, blue, purple, and special/HIT.
- HIT spaces must be clearly visible.
- START and FINISH must be obvious.

## Digital board rules

The rendered digital game must follow the board data, not a side panel approximation:

- Player tokens must sit directly on board coordinates.
- Tokens must animate through each traversed index.
- Dice result must equal the number of spaces moved.
- HIT cards trigger only when the final landed space is a HIT/action space.
- There are 25 gameplay HIT triggers.
- The visual board must show those 25 gameplay HIT triggers, even if the underlying board image only contains fewer printed HIT labels.

## UI quality requirements

The UI must feel like a polished game screen:

- Board is the hero; controls support it, not dominate it.
- No flat gray/blank background around the board.
- Use fantasy cannabis atmosphere: smoke, glow, resin shine, candy color, cloud highlights.
- Buttons must be readable and large enough on mobile.
- Player names must be visible without cluttering the board.
- Dice and latest move must be clear.
- HIT card modal must look like an intentional card reveal, not a browser alert.

## Rejection criteria

Reject the output if any of the following are true:

- The board looks like a placeholder or generic demo.
- Tokens appear off to the side instead of on the path.
- Dice rolls do not match actual spaces moved.
- HIT spaces are hidden or only partially represented.
- Prices, unrelated strain labels, or other game content appears on High Land.
- The path is broken, disconnected, too thin, or unreadable.
- Location order is wrong.
- Background is flat, empty, or visually low effort.
- UI blocks the board or makes mobile play awkward.

## Acceptance checklist

Before marking work complete, verify:

- [ ] Route loads at `/games/high-land/`.
- [ ] Local game works with 1 to 10 players.
- [ ] Online invite game works with 2 to 10 players.
- [ ] Players can name themselves.
- [ ] Invite link opens the same room in a second browser.
- [ ] Dice movement exactly matches rolled number.
- [ ] Tokens sit on board spaces and animate through path indexes.
- [ ] All 25 gameplay HIT spaces visibly appear on the board.
- [ ] Landing on each HIT trigger draws a HIT card.
- [ ] HIT card effects apply and sync online.
- [ ] Board art follows the approved 7-location order.
- [ ] Mobile layout does not horizontally overflow.
- [ ] Visual quality is polished fantasy board-game quality, not placeholder quality.

## Codex instruction

When working on High Land, treat this file as a required spec. Do not only make tests pass. Make the game visually and mechanically match the intended board-game product.
