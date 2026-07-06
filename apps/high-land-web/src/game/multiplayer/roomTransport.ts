import type { HighLandRoomState, HighLandRoomPlayer } from './roomState';
import type { GameState } from '../types/gameTypes';
import type { HighLandGameEvent } from '../events/gameEvents';

export type RoomTransportStatus = 'offline' | 'connecting' | 'connected' | 'error';

export type RoomTransportSnapshot = {
  status: RoomTransportStatus;
  room: HighLandRoomState | null;
  error: string | null;
};

export type RoomTransport = {
  createRoom(hostPlayer: HighLandRoomPlayer): Promise<HighLandRoomState>;
  joinRoom(roomCode: string, player: HighLandRoomPlayer): Promise<HighLandRoomState>;
  updateGameState(roomCode: string, gameState: GameState, requestingPlayerId: string): Promise<HighLandRoomState>;
  appendEvent(roomCode: string, event: HighLandGameEvent): Promise<void>;
  subscribe(roomCode: string, onSnapshot: (snapshot: RoomTransportSnapshot) => void): () => void;
};

export function createOfflineRoomTransport(reason = 'Supabase multiplayer is not connected yet.'): RoomTransport {
  return {
    async createRoom() {
      throw new Error(reason);
    },
    async joinRoom() {
      throw new Error(reason);
    },
    async updateGameState() {
      throw new Error(reason);
    },
    async appendEvent() {
      throw new Error(reason);
    },
    subscribe(_roomCode, onSnapshot) {
      onSnapshot({ status: 'offline', room: null, error: reason });
      return () => undefined;
    }
  };
}
