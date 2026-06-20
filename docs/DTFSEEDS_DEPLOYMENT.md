# dtfseeds.com Deployment Plan

The game should deploy as a static browser app first.

## Build locally

From the repo root:

```bash
cd apps/high-land-web
npm install
npm run test
npm run build
```

Production output:

```txt
apps/high-land-web/dist
```

## Recommended website path

Upload the contents of `dist` to this website folder:

```txt
/games/high-land/
```

Public URL target:

```txt
https://dtfseeds.com/games/high-land/
```

## WordPress integration

Use WordPress only as the menu/page wrapper.

Recommended flow:

1. Create a WordPress page called `High Land` or `Games`.
2. Add a clear button or menu link to `/games/high-land/`.
3. Keep the game hosted as static built files.
4. Do not put core gameplay logic inside WordPress/PHP.

## Hostinger / file manager upload checklist

1. Build the app.
2. Open the generated `dist` folder.
3. Upload every file and folder inside `dist` to `/public_html/games/high-land/` or the equivalent website root path.
4. Confirm `index.html` is inside `/games/high-land/`.
5. Open the public URL.
6. Check browser console for asset path errors.
7. Test mobile screen size.
8. Test mute/unmute.
9. Test one complete game from start to finish.

## Multiplayer deployment later

The future multiplayer server should not be hosted as static WordPress files.

It needs a Node.js host that supports a persistent WebSocket server. Options:

- Render
- Railway
- Fly.io
- VPS
- Hostinger VPS if available

Once multiplayer exists, the static client should read a server URL from environment config.

Example:

```txt
VITE_GAME_SERVER_URL=wss://example-server.com
```

## Acceptance checklist before public sharing

- The public URL loads without errors.
- The board is visible.
- Tokens are visible above the board.
- Dice roll cannot break turn order.
- Card effects work.
- Skip effects work.
- Finish/win screen works.
- Audio can be muted.
- Mobile layout is usable.
- No copyrighted board-game assets are included.
