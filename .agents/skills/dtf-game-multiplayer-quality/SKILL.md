---
name: dtf-game-multiplayer-quality
description: Improve DTF multiplayer games: room creation/joining, authority, reconnect, latency hiding, interpolation/prediction, invite flows, presence, hidden-state privacy, rematches, host migration, load testing, and failure recovery.
metadata:
  author: dtfgenetics
  version: "1.0.0"
---

# DTF Game Multiplayer Quality

Resolve location first with `dtf-game-location-resolver`; multiplayer copies in different repos are easy to confuse.

## Required audit

For every multiplayer title inspect:
- canonical server authority;
- identity/session ownership;
- create/join/invite/deep-link flow;
- hidden information exposure;
- legal action validation;
- reconnect/resume grace;
- host migration;
- spectator semantics where applicable;
- room expiration/persistence;
- rate limits and sequence/revision checks;
- latency handling;
- client interpolation/prediction/reconciliation for real-time play;
- background-tab and network-change behavior;
- rematch lifecycle;
- two-independent-client acceptance;
- load/bandwidth limits;
- production WSS/API/health checks.

## Runtime-specific guidance

For Colyseus 0.18 games, evaluate its current fixed-timestep/input-buffering/prediction/interpolation capabilities before maintaining bespoke network stepping.

For PHP/HTTP polling games, measure poll frequency, duplicate requests, visibility handling, stale-room behavior and server storage pressure before adding cosmetic networking code.

## Never prove multiplayer with one browser

A production claim requires at least two independent sessions/devices or an equivalent deterministic integration harness plus live endpoint verification.
