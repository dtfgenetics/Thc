# Game Server

This is the future multiplayer server scaffold.

Do not make this the first priority. Finish and test the local browser game first.

## Run

```bash
npm install
npm run dev
```

Default local health check:

```txt
http://localhost:2567/health
```

## Current status

This server has the first Colyseus room scaffold only. It still needs to share rules with the web app before it is production-ready.

## Next steps

- Move common rules into a shared package.
- Add action-card effects server-side.
- Add room code UI in the browser app.
- Add reconnect handling.
- Add two-browser automated tests.
