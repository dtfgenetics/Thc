import type { GameState } from '../game/types/gameTypes';

export type RoomStatus = 'lobby' | 'playing' | 'finished';
export type ConnectionStatus = 'idle' | 'connecting' | 'connected' | 'offline';

export type RoomPlayer = {
  id: string;
  name: string;
  color: string;
  token: string;
  connected: boolean;
  joinedAt: number;
};

export type RoomSnapshot = {
  gameId: string;
  status: RoomStatus;
  hostPlayerId: string;
  players: RoomPlayer[];
  gameState: GameState | null;
  version: number;
  updatedAt: number;
  maxPlayers: number;
};

export type RoomCredentials = {
  gameId: string;
  playerId: string;
  playerToken: string;
};

export type RoomApiResponse = {
  room: RoomSnapshot;
  credentials?: RoomCredentials;
};

export type InviteStatus = 'none' | 'checking' | 'joinable' | 'invalid' | 'full';
