import { createLocalRoom, joinLocalRoom, type LocalRoomPlayerInput } from './localRoomRepository';
import { createInviteLink } from './inviteLinks';
import { createGameFromRoom } from './roomGameFactory';
import type { HighLandRoomState } from './roomState';
import type { GameState } from '../types/gameTypes';

export type RoomSession = {
  room: HighLandRoomState;
  inviteUrl: string;
};

export type RoomStartResult = {
  gameState: GameState;
  playerCount: number;
  leadPlayerName: string;
};

export function createRoomSession(hostPlayer: LocalRoomPlayerInput): RoomSession {
  const room = createLocalRoom(hostPlayer);
  return formatRoomSession(room);
}

export function joinRoomSession(roomCode: string, player: LocalRoomPlayerInput): RoomSession {
  const room = joinLocalRoom(roomCode, player);
  return formatRoomSession(room);
}

export function formatRoomSession(room: HighLandRoomState): RoomSession {
  return {
    room,
    inviteUrl: createInviteLink(room.code).url
  };
}

export function canStartRoomSession(room: HighLandRoomState, playerId: string): boolean {
  return room.hostPlayerId === playerId && room.players.length >= 2 && room.status === 'waiting';
}

export function startRoomSession(room: HighLandRoomState): RoomStartResult {
  const gameState = createGameFromRoom(room);
  return {
    gameState,
    playerCount: gameState.players.length,
    leadPlayerName: gameState.players[0]?.name ?? 'Player 1'
  };
}
