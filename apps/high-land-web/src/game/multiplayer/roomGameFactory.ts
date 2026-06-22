import { createInitialGame } from '../systems/gameEngine';
import type { GameState } from '../types/gameTypes';
import type { HighLandRoomState } from './roomState';

export function createGameFromRoom(room: HighLandRoomState): GameState {
  const playerCount = Math.max(2, room.players.length);
  const game = createInitialGame(playerCount);
  const roomPlayers = room.players.map((player) => ({
    ...player,
    name: normalizeDisplayName(player.name) ?? player.name
  }));
  const leadName = roomPlayers[0]?.name ?? 'Player 1';

  return {
    ...game,
    players: game.players.map((player, index) => {
      const roomPlayer = roomPlayers[index];
      if (!roomPlayer) return player;

      return {
        ...player,
        id: roomPlayer.id,
        name: roomPlayer.name,
        token: roomPlayer.token,
        color: roomPlayer.color
      };
    }),
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
