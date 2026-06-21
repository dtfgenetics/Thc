import type { Player, PlayerToken } from '../types/gameTypes';

export const minPlayers = 1;
export const maxPlayers = 10;

export const tokenOrder: PlayerToken[] = [
  'tokenA',
  'tokenB',
  'tokenC',
  'tokenD',
  'tokenE',
  'tokenF',
  'tokenG',
  'tokenH',
  'tokenI',
  'tokenJ'
];

export const tokenColors = [
  '#f43f5e',
  '#3b82f6',
  '#22c55e',
  '#eab308',
  '#a855f7',
  '#14b8a6',
  '#f97316',
  '#ec4899',
  '#84cc16',
  '#38bdf8'
];

export function createPlayers(count: number, names: string[] = []): Player[] {
  if (!Number.isInteger(count) || count < minPlayers || count > maxPlayers) {
    throw new Error(`Player count must be between ${minPlayers} and ${maxPlayers}.`);
  }

  return Array.from({ length: count }, (_, index) => ({
    id: `player-${index + 1}`,
    name: sanitizeDisplayName(names[index], index + 1),
    token: tokenOrder[index],
    color: tokenColors[index],
    positionIndex: 0,
    skipTurns: 0,
    protectedFromBackward: 0
  }));
}

export function sanitizeDisplayName(value: string | undefined, playerNumber: number): string {
  const normalized = value?.trim().replace(/\s+/g, ' ').slice(0, 24) ?? '';
  return normalized || `Player ${playerNumber}`;
}

export function updatePlayer(players: Player[], playerId: string, updater: (player: Player) => Player): Player[] {
  return players.map((player) => (player.id === playerId ? updater(player) : player));
}
