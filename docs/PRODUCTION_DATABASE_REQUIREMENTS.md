# Production Database Requirements

The in-memory and JSON-file room stores are intentionally limited to development and single-instance staging. Public multiplayer requires a durable database adapter with atomic state-version updates.

## Recommended provider

Use Supabase PostgreSQL through a server-only connection. Hostinger's Node.js dashboard supports connecting Supabase and storing connection values as deployment environment variables.

Do not place a Supabase service-role key or database password in Vite client variables, browser code, GitHub files or screenshots.

## Minimum schema

### `multiplayer_rooms`

```sql
create table multiplayer_rooms (
  id uuid primary key,
  code text not null unique,
  game_slug text not null,
  status text not null,
  host_player_id uuid not null,
  max_players integer not null,
  version bigint not null,
  state jsonb not null,
  created_at timestamptz not null,
  updated_at timestamptz not null,
  expires_at timestamptz not null
);
```

### `multiplayer_actions`

```sql
create table multiplayer_actions (
  id uuid primary key,
  room_id uuid not null references multiplayer_rooms(id) on delete cascade,
  action_id text not null,
  player_id uuid not null,
  action_type text not null,
  expected_version bigint not null,
  resulting_version bigint not null,
  payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  unique (room_id, action_id)
);
```

The action table is append-only and supplies idempotency, support diagnostics and future replay/audit capability.

## Atomic mutation rule

Every authoritative action must update a room only when its current version equals the request's `expectedVersion`.

Conceptually:

```sql
update multiplayer_rooms
set state = :next_state,
    status = :next_status,
    version = version + 1,
    updated_at = now()
where code = :room_code
  and version = :expected_version;
```

If zero rows update, return `STALE_VERSION`. Do not read a row, update it later without a version predicate, and assume the transaction is safe.

The room update and action-log insert must run in one database transaction. A PostgreSQL function/RPC is the preferred implementation because it can enforce both operations atomically.

## Required indexes

```sql
create index multiplayer_rooms_expires_at_idx on multiplayer_rooms (expires_at);
create index multiplayer_rooms_status_updated_idx on multiplayer_rooms (status, updated_at);
create index multiplayer_actions_room_created_idx on multiplayer_actions (room_id, created_at);
```

## Cleanup

Run an hourly cleanup job that removes:

- waiting rooms past `expires_at`
- abandoned rooms past `expires_at`
- completed rooms after the retention window

Keep action logs only as long as the published privacy and support policy requires.

## Security

- Database credentials stay server-side.
- Browser clients call the multiplayer API, not database write endpoints.
- The API validates the player session before every room read or mutation.
- Reconnect tokens remain hashed at rest.
- Logs must never contain raw reconnect tokens or database credentials.
- Backups and restore testing are required before domain cutover.

## Acceptance criteria

- Two server processes can update different rooms safely.
- Two simultaneous actions against one version result in exactly one successful mutation.
- Repeating an action ID returns the original resulting state without applying it twice.
- Restarting the API preserves active rooms.
- Database outage errors are structured and do not corrupt local state.
- Cleanup removes expired rooms without affecting active rooms.
- Backup restoration is demonstrated in staging.
