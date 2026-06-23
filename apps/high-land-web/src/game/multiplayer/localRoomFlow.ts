import { joinLocalRoom, type LocalRoomPlayerInput } from './localRoomRepository';
import type { HighLandRoomState } from './roomState';
import { maxPlayers, tokenColors, tokenOrder } from '../systems/playerSystem';

export function createLocalTestPlayer(index: number): LocalRoomPlayerInput {
  const safeIndex = Math.max(0, Math.min(index, tokenOrder.length - 1));

  return {
    id: `local-player-${safeIndex + 1}`,
    name: `Player ${safeIndex + 1}`,
    token: tokenOrder[safeIndex] ?? tokenOrder[0],
    color: tokenColors[safeIndex] ?? tokenColors[0]
  };
}

export function addLocalTestPlayerToRoom(room: HighLandRoomState, storage?: Storage): HighLandRoomState {
  if (room.players.length >= maxPlayers) {
    throw new Error(`High Land supports up to ${maxPlayers} players.`);
  }

  const nextPlayer = createLocalTestPlayer(room.players.length);
  return joinLocalRoom(room.code, nextPlayer, storage);
}

export function getRoomPlayerNames(room: HighLandRoomState): string[] {
  return room.players.map((player) => player.name);
}
