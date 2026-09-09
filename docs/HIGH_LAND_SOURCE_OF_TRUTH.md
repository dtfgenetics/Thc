# High Land — Source of Truth

## Canonical ownership

**GitHub `dtfgenetics/Thc`** is canonical for the High Land browser implementation, automated tests, room/session logic, board-path data used by the app, build configuration, and deployment workflows.

**Google Drive `04 Games/High Land`** is canonical for approved human-readable rules, board/art masters, HIT card masters, audio source/approved files, player-token art, print files, playtest/release records, and historical approved source assets.

**ChatGPT Library `DTF Working Projects/02 Games/Highland`** is a working/recovery surface only. Content found there must be reviewed against Drive/GitHub before promotion. It is not an independent master.

## Code location

- App: `apps/high-land-web`
- Default branch: `main`
- Build: `npm run build:high-land`
- Test: `npm run test:high-land`
- Browser-tool policy: `node scripts/verify-browser-tool-policy.mjs`
- Production target: `https://dtfseeds.com/games/high-land/`

## Locked product rules

- Preserve one continuous board path.
- Dice movement must exactly equal spaces moved.
- Tokens render on board-path coordinates rather than in a detached UI area.
- Multiplayer requires player names and room/invite flow.
- HIT/action cards, skip-turn rules, finish/win logic, reverse-turn logic, and background-audio mute behavior must remain testable.
- Board artwork and HIT-card artwork must come from approved Drive assets or explicitly approved new originals.

## Validation rule

High Land repo validation is deterministic: install, unit tests, TypeScript/Vite build, room API security checks, PHP lint where applicable, and the browser-tool policy. Playwright is retired from the active High Land gate.

Manual browser and live-route review are still required before calling a deployed artifact live-ready, but they are recorded separately from repository validation.

## Change rule

When code and a Drive document disagree, do not silently choose one. Treat the locked/approved Drive game rule or art master as the human design authority and update the code/data/tests to match it, unless a later controlled decision explicitly supersedes the Drive master.

Do not create a second High Land production repository or a second Drive master folder.

## Release rule

A release must pass `docs/PORTFOLIO_RELEASE_CRITERIA.md`, the High Land deterministic test/build checks, and live route verification after deployment.
