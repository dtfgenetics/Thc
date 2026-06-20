# Player Count Plan

The game should support up to 10 players.

## Target player counts

- Local pass-and-play: 2-10 players.
- Online multiplayer: 2-10 players.
- First testing target: 2-4 players.
- Expanded testing target: 5-10 players.

## Why 10 players changes the design

Ten players is possible, but it requires better UI and pacing than a 2-4 player board game.

Required changes:

- More token colors.
- More token labels.
- Token clustering around the same space so players do not overlap completely.
- Scrollable or compact player list.
- Faster animations option.
- Clear current-player highlight.
- Optional turn timer for online multiplayer.
- Room limit set to 10 on the server.

## Recommended options for 10-player mode

### Local mode

Local mode can support 10 with pass-and-play.

Add:

- 2, 3, 4, 5, 6, 8, and 10 player quick-select buttons.
- editable player names later.
- compact player chips.

### Online mode

Online rooms should support 10 players, but only after server-authoritative multiplayer is wired.

Add later:

- room code
- player ready state
- host start
- reconnect support
- turn timer
- idle auto-skip option

## Token layout rule

When multiple tokens are on the same board space, spread them in a circle around that space.

Do not stack all players directly on the same coordinate.

## Game pacing options

For 6-10 players, include these options:

- Fast animations.
- Auto-end turn after card resolves.
- Optional 30-second online turn timer.
- Optional shorter board path mode later.

## Immediate code changes needed

- Update player system max from 4 to 10.
- Add 10 token colors.
- Add player count buttons up to 10.
- Update Phaser token offsets for up to 10 tokens.
- Update server maxClients from 4 to 10.
- Update docs and tests.
