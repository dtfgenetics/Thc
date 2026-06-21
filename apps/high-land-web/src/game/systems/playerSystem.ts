import type { Player, PlayerToken } from '../types/gameTypes';
import { normalizePlayerName } from './finalBoardMovement';

export const minPlayers = 2;
export const maxPlayers = 4;

export const tokenOrder: PlayerToken[] = [
  'tokenA',
  'tokenB',
  'tokenC',
  'tokenD'
];

export const tokenColors = [
  '#f43f5e',
  '#22c55e',
  '#3b82f6',
  '#eab308'
];

export function createPlayers(count: number, names: string[] = []): Player[] {
  if (!Number.isInteger(count) || count < minPlayers || count > maxPlayers) {
    throw new Error(`Player count must be between ${minPlayers} and ${maxPlayers}.`);
  }

  return Array.from({ length: count }, (_, index) => {
    const fallbackName = `Player ${index + 1}`;
    return {
      id: `player-${index + 1}`,
      name: normalizePlayerName(names[index] ?? '', fallbackName),
      token: tokenOrder[index],
      color: tokenColors[index],
      positionIndex: 0,
      skipTurns: 0,
      protectedFromBackward: 0
    };
  });
}

export function updatePlayer(players: Player[], playerId: string, updater: (player: Player) => Player): Player[] {
  return players.map((player) => (player.id === playerId ? updater(player) : player));
}
