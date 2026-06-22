import type { HighLandRoomPlayer, HighLandRoomState } from './roomState';
import type { SupabaseGamePlayerRow, SupabaseGameSessionRow, SupabaseHighLandEventRow } from './supabaseRoomTypes';
import type { HighLandGameEvent } from '../events/gameEvents';

export function mapSessionAndPlayersToRoom(
  session: SupabaseGameSessionRow,
  players: SupabaseGamePlayerRow[]
): HighLandRoomState {
  return {
    id: session.id,
    code: session.room_code,
    status: session.status,
    hostPlayerId: session.host_player_id,
    players: players.map(mapPlayerRowToRoomPlayer),
    gameState: session.game_state,
    createdAt: session.created_at,
    updatedAt: session.updated_at
  };
}

export function mapPlayerRowToRoomPlayer(row: SupabaseGamePlayerRow): HighLandRoomPlayer {
  return {
    id: row.id,
    name: row.display_name,
    token: row.token as HighLandRoomPlayer['token'],
    color: row.color,
    joinedAt: row.joined_at,
    connected: row.connected,
    host: row.is_host
  };
}

export function mapRoomPlayerToPlayerInsert(player: HighLandRoomPlayer, sessionId: string): Omit<SupabaseGamePlayerRow, 'last_seen_at'> {
  return {
    id: player.id,
    session_id: sessionId,
    display_name: player.name,
    token: player.token,
    color: player.color,
    connected: player.connected,
    is_host: player.host,
    joined_at: player.joinedAt
  };
}

export function mapGameEventToEventInsert(event: HighLandGameEvent, sessionId: string): Omit<SupabaseHighLandEventRow, 'id'> {
  return {
    session_id: sessionId,
    player_id: event.playerId,
    event_name: event.name,
    payload: event.payload,
    created_at: event.createdAt
  };
}
