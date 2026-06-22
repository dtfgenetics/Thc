import type { GameState } from '../types/gameTypes';
import type { HighLandGameEvent } from '../events/gameEvents';

export type SupabaseGameSessionRow = {
  id: string;
  game_slug: 'high-land';
  room_code: string;
  status: 'waiting' | 'playing' | 'complete' | 'abandoned';
  host_player_id: string | null;
  game_state: GameState | null;
  created_at: string;
  updated_at: string;
};

export type SupabaseGamePlayerRow = {
  id: string;
  session_id: string;
  display_name: string;
  token: string;
  color: string;
  connected: boolean;
  is_host: boolean;
  joined_at: string;
  last_seen_at: string;
};

export type SupabaseGameInviteRow = {
  id: string;
  session_id: string;
  room_code: string;
  created_by_player_id: string | null;
  expires_at: string | null;
  created_at: string;
};

export type SupabaseHighLandTurnRow = {
  id: string;
  session_id: string;
  player_id: string;
  turn_number: number;
  dice_roll: number | null;
  from_index: number | null;
  to_index: number | null;
  card_id: string | null;
  created_at: string;
};

export type SupabaseHighLandEventRow = {
  id: string;
  session_id: string;
  player_id: string | null;
  event_name: HighLandGameEvent['name'];
  payload: HighLandGameEvent['payload'];
  created_at: string;
};
