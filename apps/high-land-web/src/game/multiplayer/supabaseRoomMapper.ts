import type { HighLandRoomPlayer, HighLandRoomState } from './roomState';
import type { SupabaseGamePlayerRow, SupabaseGameSessionRow, SupabaseHighLandEventRow } from './supabaseRoomTypes';
import type { HighLandGameEvent } from '../events/gameEvents';
import { tokenColors, tokenOrder } from '../systems/playerSystem';

export function mapSessionAndPlayersToRoom(
  session: SupabaseGameSessionRow,
  players: SupabaseGamePlayerRow[]
): HighLandRoomState {
  const roomPlayers = players.map(mapPlayerRowToRoomPlayer);
  const hostPlayerId = session.host_player_id ?? roomPlayers.find((player) => player.host)?.id ?? roomPlayers[0]?.id ?? '';

  return {
    id: session.id,
    code: session.room_code,
    status: session.status,
    hostPlayerId,
    players: roomPlayers,
    gameState: session.game_state,
    createdAt: session.created_at,
    updatedAt: session.updated_at
  };
}

export function mapPlayerRowToRoomPlayer(row: SupabaseGamePlayerRow, index = 0): HighLandRoomPlayer {
  return {
    id: row.id,
    name: row.display_name,
    token: normalizeToken(row.token, index),
    color: row.color || getFallbackColor(index),
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

function normalizeToken(token: string, index: number): HighLandRoomPlayer['token'] {
  return tokenOrder.includes(token as HighLandRoomPlayer['token'])
    ? token as HighLandRoomPlayer['token']
    : tokenOrder[index % tokenOrder.length] ?? tokenOrder[0];
}

function getFallbackColor(index: number): string {
  return tokenColors[index % tokenColors.length] ?? tokenColors[0];
}
