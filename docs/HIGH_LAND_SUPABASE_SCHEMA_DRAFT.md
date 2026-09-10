# High Land Supabase Schema Draft — Optional Architecture Reference

This is a historical design draft that may be reused, changed, migrated, or discarded. High Land is not locked to Hostinger, Supabase, or any other multiplayer backend.

## Goal

Support browser multiplayer for High Land with room codes, invite links, named players, shared turns, and event history.

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

Purpose: optional record of dice turns.

Fields:

```txt
id: uuid primary key
session_id: uuid references game_sessions
player_id: uuid references game_players
turn_number: integer
dice_roll: integer
from_index: integer
to_index: integer
card_id: text nullable
created_at: timestamp
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

## Security considerations

If this or a similar backend is used, protect room state with an appropriate authorization model. Do not expose service-role keys, database credentials, private room state, or unrestricted public mutation access.

Possible identity approaches include guest room tokens, authenticated users, or a hybrid model. Choose the model that best fits the current game design and hosting architecture.

## Implementation status

This file is not an executable migration. It is available as a reference if a Supabase-based or relational multiplayer architecture becomes useful. The implementation may diverge from or replace this draft entirely.
