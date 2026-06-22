import type { GameState, Player } from '../types/gameTypes';
import { maxPlayers } from '../systems/playerSystem';

export type HighLandRoomStatus = 'waiting' | 'playing' | 'complete' | 'abandoned';

export type HighLandRoomPlayer = Pick<Player, 'id' | 'name' | 'token' | 'color'> & {
  joinedAt: string;
  connected: boolean;
  host: boolean;
};

export type HighLandRoomState = {
  id: string;
  code: string;
  status: HighLandRoomStatus;
  hostPlayerId: string;
  players: HighLandRoomPlayer[];
  gameState: GameState | null;
  createdAt: string;
  updatedAt: string;
};

export function canStartRoom(room: HighLandRoomState, requestingPlayerId: string): boolean {
  return room.status === 'waiting' && room.hostPlayerId === requestingPlayerId && room.players.length >= 2;
}

export function canPlayerRoll(room: HighLandRoomState, requestingPlayerId: string): boolean {
  if (room.status !== 'playing' || !room.gameState) return false;
  const currentPlayer = room.gameState.players[room.gameState.currentPlayerIndex];
  return currentPlayer?.id === requestingPlayerId;
}

export function upsertRoomPlayer(room: HighLandRoomState, player: HighLandRoomPlayer): HighLandRoomState {
  const exists = room.players.some((existingPlayer) => existingPlayer.id === player.id);
  if (!exists && room.players.length >= maxPlayers) {
    throw new Error(`High Land supports up to ${maxPlayers} players.`);
  }

  const players = exists
    ? room.players.map((existingPlayer) => (existingPlayer.id === player.id ? player : existingPlayer))
    : [...room.players, player];

  return {
    ...room,
    players,
    updatedAt: new Date().toISOString()
  };
}
