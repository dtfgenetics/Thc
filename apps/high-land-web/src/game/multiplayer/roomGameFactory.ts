import { createInitialGame } from '../systems/gameEngine';
import type { GameState } from '../types/gameTypes';
import type { HighLandRoomState } from './roomState';

export function createGameFromRoom(room: HighLandRoomState): GameState {
  const playerCount = Math.max(2, room.players.length);
  const game = createInitialGame(playerCount);
  const roomPlayerNames = room.players.map((player) => normalizeDisplayName(player.name));
  const leadName = roomPlayerNames[0] ?? 'Player 1';

  return {
    ...game,
    players: game.players.map((player, index) => ({
      ...player,
      name: roomPlayerNames[index] ?? player.name
    })),
    message: `${leadName}, roll to begin.`
  };
}

export function createNamedLocalGame(playerCount: number, playerName: string): GameState {
  const game = createInitialGame(playerCount);
  const leadName = normalizeDisplayName(playerName) ?? 'Player 1';

  return {
    ...game,
    players: game.players.map((player, index) => (index === 0 ? { ...player, name: leadName } : player)),
    message: `${leadName}, roll to begin.`
  };
}

function normalizeDisplayName(name: string): string | null {
  const normalized = name.trim().replace(/\s+/g, ' ');
  return normalized.length > 0 ? normalized : null;
}
