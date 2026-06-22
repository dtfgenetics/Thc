import type { HighLandRoomState } from '../game/multiplayer/roomState';

export type HighLandScreenMode = 'landing' | 'local' | 'create_room' | 'join_room' | 'lobby' | 'playing';

export type HighLandAppFlowState = {
  screenMode: HighLandScreenMode;
  playerCount: number;
  localPlayerId: string | null;
  localPlayerName: string | null;
  room: HighLandRoomState | null;
  statusMessage: string;
};

export type HighLandAppFlowAction =
  | { type: 'choose_mode'; mode: 'local' | 'create_room' | 'join_room' }
  | { type: 'back_to_landing'; message?: string }
  | { type: 'local_game_started'; playerName: string; playerCount: number }
  | { type: 'room_created'; playerName: string; playerId: string; playerCount: number; room: HighLandRoomState }
  | { type: 'room_joined'; playerName: string; playerId: string; room: HighLandRoomState }
  | { type: 'room_left' }
  | { type: 'game_started'; playerCount: number; message: string }
  | { type: 'saved_game_loaded'; playerName: string | null; playerCount: number };

export const initialHighLandAppFlowState: HighLandAppFlowState = {
  screenMode: 'landing',
  playerCount: 2,
  localPlayerId: null,
  localPlayerName: null,
  room: null,
  statusMessage: 'Choose local play, create a room, or join a room.'
};

export function reduceHighLandAppFlow(
  state: HighLandAppFlowState,
  action: HighLandAppFlowAction
): HighLandAppFlowState {
  switch (action.type) {
    case 'choose_mode':
      return { ...state, screenMode: action.mode };
    case 'back_to_landing':
      return {
        ...state,
        screenMode: 'landing',
        statusMessage: action.message ?? 'Choose local play, create a room, or join a room.'
      };
    case 'local_game_started':
      return {
        ...state,
        screenMode: 'playing',
        playerCount: action.playerCount,
        localPlayerName: action.playerName,
        room: null,
        statusMessage: `${action.playerName}, roll to begin.`
      };
    case 'room_created':
      return {
        ...state,
        screenMode: 'lobby',
        playerCount: action.playerCount,
        localPlayerId: action.playerId,
        localPlayerName: action.playerName,
        room: action.room,
        statusMessage: `Room ${action.room.code} created locally. Share the invite when Supabase sync is wired.`
      };
    case 'room_joined':
      return {
        ...state,
        screenMode: 'lobby',
        playerCount: Math.max(2, action.room.players.length),
        localPlayerId: action.playerId,
        localPlayerName: action.playerName,
        room: action.room,
        statusMessage: `Joined local room ${action.room.code}.`
      };
    case 'room_left':
      return {
        ...state,
        screenMode: 'landing',
        room: null,
        statusMessage: 'Left the room. Choose a play mode.'
      };
    case 'game_started':
      return {
        ...state,
        screenMode: 'playing',
        playerCount: action.playerCount,
        statusMessage: action.message
      };
    case 'saved_game_loaded':
      return {
        ...state,
        screenMode: 'playing',
        playerCount: action.playerCount,
        localPlayerName: action.playerName,
        statusMessage: 'Saved game loaded.'
      };
  }
}
