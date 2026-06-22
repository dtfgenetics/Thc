# High Land Supabase Schema Draft

This is a design draft, not an executable migration. Keep `.mcp.json` read-only until this is reviewed.

## Goal

Support real browser multiplayer for **High Land: The Sweet Escape** with room codes, invite links, named players, shared turns, and event history.

## Proposed tables

### game_sessions

Purpose: one room/game session.

Fields:

```txt
id: uuid primary key
room_code: text unique
status: waiting | playing | complete | abandoned
host_player_id: uuid nullable until host player exists
game_state: json/jsonb snapshot
created_at: timestamp
updated_at: timestamp
```

Indexes:

```txt
room_code
status
updated_at
```

### game_players

Purpose: players in a session.

Fields:

```txt
id: uuid primary key
session_id: uuid references game_sessions
display_name: text, 2-24 characters
token: text
color: text
connected: boolean
is_host: boolean
joined_at: timestamp
last_seen_at: timestamp
```

Indexes:

```txt
session_id
session_id + display_name
```

### game_invites

Purpose: invite metadata for room links.

Fields:

```txt
id: uuid primary key
session_id: uuid references game_sessions
room_code: text
created_by_player_id: uuid references game_players
expires_at: timestamp nullable
created_at: timestamp
```

Indexes:

```txt
room_code
session_id
```

### high_land_turns

Purpose: permanent record of dice turns.

Fields:

```txt
id: uuid primary key
session_id: uuid references game_sessions
player_id: uuid references game_players
turn_number: integer
dice_roll: integer 1-6
from_index: integer
to_index: integer
card_id: text nullable
created_at: timestamp
```

Indexes:

```txt
session_id + turn_number
player_id
```

### high_land_events

Purpose: event log for debugging, replay, and sync.

Fields:

```txt
id: uuid primary key
session_id: uuid references game_sessions
player_id: uuid nullable references game_players
event_name: text
payload: json/jsonb
created_at: timestamp
```

Event names should match:

```txt
room_created
player_joined
game_started
dice_rolled
player_moved
hit_card_drawn
skip_turn_applied
winner_declared
```

Indexes:

```txt
session_id + created_at
event_name
```

## RLS requirements

Enable RLS on every public table.

Required access model:

```txt
Only room participants can read session, player, turn, and event data for that room.
Only the active player can write a dice turn.
Only the host can start the game.
Only the system/server trusted path should finalize winner state if that becomes server-side later.
```

## Critical decision before migration

Codex must decide one of these before writing the real migration:

```txt
Option A: guest multiplayer with room secret / join token
Option B: authenticated Supabase users
Option C: hybrid: guest rooms now, auth accounts later
```

For fast browser-game progress, use **Option A** first, but do not expose broad public update access. Use a room secret or join token so random visitors cannot mutate every room.

## Do not do

```txt
Do not commit service-role keys.
Do not put database passwords in frontend env vars.
Do not create broad public update policies.
Do not remove read_only=true from .mcp.json until approved.
Do not claim multiplayer is done until two browsers share one room state.
```

## Codex next step

Write a real migration only after this draft is approved. Then run local Supabase verification before remote application.
