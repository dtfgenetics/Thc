import { describe, expect, it } from 'vitest';
import { mapGameEventToEventInsert, mapPlayerRowToRoomPlayer, mapSessionAndPlayersToRoom } from './supabaseRoomMapper';
import type { SupabaseGamePlayerRow, SupabaseGameSessionRow } from './supabaseRoomTypes';
import type { RoomCreatedEvent } from '../events/gameEvents';

const playerRow: SupabaseGamePlayerRow = {
  id: 'player-1',
  session_id: 'session-1',
  display_name: 'Blaze Runner',
  token: 'tokenA',
  color: '#f43f5e',
  connected: true,
  is_host: true,
  joined_at: 'now',
  last_seen_at: 'now'
};

const sessionRow: SupabaseGameSessionRow = {
  id: 'session-1',
  game_slug: 'high-land',
  room_code: 'ABCD23',
  status: 'waiting',
  host_player_id: 'player-1',
  game_state: null,
  created_at: 'now',
  updated_at: 'now'
};

describe('supabase room mapper', () => {
  it('maps player rows to room players', () => {
    const player = mapPlayerRowToRoomPlayer(playerRow);

    expect(player.name).toBe('Blaze Runner');
    expect(player.host).toBe(true);
    expect(player.token).toBe('tokenA');
  });

  it('maps session and player rows to room state', () => {
    const room = mapSessionAndPlayersToRoom(sessionRow, [playerRow]);

    expect(room.code).toBe('ABCD23');
    expect(room.players).toHaveLength(1);
    expect(room.players[0].name).toBe('Blaze Runner');
  });

  it('maps game events to event inserts', () => {
    const event: RoomCreatedEvent = {
      id: 'event-1',
      name: 'room_created',
      roomCode: 'ABCD23',
      playerId: 'player-1',
      createdAt: 'now',
      payload: { roomCode: 'ABCD23', hostPlayerId: 'player-1' }
    };

    const insert = mapGameEventToEventInsert(event, 'session-1');

    expect(insert.session_id).toBe('session-1');
    expect(insert.event_name).toBe('room_created');
    expect(insert.payload.roomCode).toBe('ABCD23');
  });
});
