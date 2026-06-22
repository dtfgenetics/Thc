# High Land Deployment Verification

Use this checklist before claiming the live game is fixed on:

```txt
https://dtfseeds.com/games/high-land/
```

## 1. Build verification

Run from repo root:

```bash
npm install
npm run test:high-land
npm run build:high-land
```

Expected output directory:

```txt
apps/high-land-web/dist
```

Expected production base path:

```txt
/games/high-land/
```

## 2. Hostinger / WordPress settings

Confirm:

```txt
Repository: dtfgenetics/Thc
Branch: main
Build command: npm run build:high-land
Output directory: apps/high-land-web/dist
Route: /games/high-land/
```

## 3. Browser runtime check

Open:

```txt
https://dtfseeds.com/games/high-land/
```

Check:

```txt
- Page title and High Land heading appear.
- Phaser canvas renders.
- Board art loads, or fallback board renders.
- Tokens appear on board path spaces.
- Dice button works.
- Roll amount matches visual movement.
- HIT card modal appears on HIT/card spaces.
- Restart works.
- Mute/unmute works.
```

## 4. DevTools check

Open browser DevTools.

Check console:

```txt
- No uncaught JS errors.
- No missing module errors.
- No asset 404s for JS/CSS/images/audio.
```

Check Network tab:

```txt
- JS bundles load from /games/high-land/.
- CSS loads from /games/high-land/.
- Board/audio assets load from the expected base path.
```

## 5. Mobile check

Test viewport:

```txt
390x844
```

Check:

```txt
- Setup panel is usable.
- Board fits screen.
- Tokens do not drift off the board.
- Buttons remain tappable.
- Lobby/invite UI remains readable.
```

## 6. Room flow check after wiring

When room/lobby work is wired:

```txt
- Host creates room.
- Invite link includes ?room=CODE.
- Join screen reads the room code.
- Name is required to join.
- Lobby shows host and joined player.
- Host start is disabled until at least 2 players.
```

## 7. Real multiplayer check after Supabase wiring

Do not claim this is done until:

```txt
- Browser A creates room.
- Browser B joins with invite link.
- Both browsers show same player list.
- Host starts game.
- Only current player can roll.
- Dice result, position, HIT card, and turn advance sync to both browsers.
- Refresh does not immediately destroy the room.
```
