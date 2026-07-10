# Multiplayer Release Gates

Do not merge, deploy to the production domain or advertise online multiplayer until each applicable gate has evidence.

## Code gate

- [ ] Root `npm ci` completes from a clean checkout.
- [ ] High Land unit tests pass.
- [ ] High Land production build passes.
- [ ] Multiplayer server strict TypeScript build passes.
- [ ] Multiplayer server domain and HTTP integration tests pass.
- [ ] Browser smoke tests pass.
- [ ] PHP syntax checks continue to pass for the rollback transport.
- [ ] No high-severity dependency finding remains unexplained.

## Security gate

- [ ] Dice, movement, cards, turn order and winning are server-authoritative.
- [ ] Raw reconnect tokens do not appear in stored room state or logs.
- [ ] Invalid player sessions receive HTTP 401.
- [ ] Non-host start attempts receive HTTP 403.
- [ ] Out-of-turn actions receive HTTP 409.
- [ ] Stale versions receive HTTP 409.
- [ ] Duplicate action IDs do not apply twice.
- [ ] Production CORS allows only approved HTTPS origins.
- [ ] Production secrets exist only in Hostinger environment variables.

## Persistence gate

- [ ] A durable production database adapter replaces JSON storage.
- [ ] Room mutation and action-log insertion are atomic.
- [ ] Simultaneous actions against one version yield one winner.
- [ ] API restarts preserve active games.
- [ ] Expired-room cleanup is operational.
- [ ] A backup restore has been tested.

## Staging gameplay gate

- [ ] Two separate devices create and join a room.
- [ ] Both devices show matching lobby members and ready state.
- [ ] Host-only start is enforced.
- [ ] Every dice result and HIT-card effect matches on both devices.
- [ ] Refresh and temporary network loss reconnect the correct players.
- [ ] Double-clicking Roll produces one move.
- [ ] A full game reaches board index 108 and declares one winner.
- [ ] Mobile layout remains usable throughout a complete game.
- [ ] Server restart and recovery have been tested.

## Domain gate

- [ ] Existing `dtf420.com` content is backed up.
- [ ] Temporary Hostinger URLs pass all staging checks.
- [ ] Production API and web origins are configured before DNS change.
- [ ] SSL works on both web and API hostnames.
- [ ] Rollback instructions and the prior domain target are recorded.
- [ ] `dtfseeds.com` remains available and unchanged.

## Approval rule

The pull request may leave draft only after the code gate passes. Production domain cutover requires every gate above.
