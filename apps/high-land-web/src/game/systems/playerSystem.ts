import type { Player, PlayerToken } from '../types/gameTypes';

export const minPlayers = 2;
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
  '#22c55e',
  '#3b82f6',
  '#eab308',
  '#a855f7',
  '#14b8a6',
  '#f97316',
  '#ec4899',
  '#84cc16',
  '#38bdf8'
];

export function createPlayers(count: number): Player[] {
  if (!Number.isInteger(count) || count < minPlayers || count > maxPlayers) {
    throw new Error(`Player count must be between ${minPlayers} and ${maxPlayers}.`);
  }

  return Array.from({ length: count }, (_, index) => ({
    id: `player-${index + 1}`,
    name: `Player ${index + 1}`,
    token: getPlayerToken(index),
    color: getPlayerColor(index),
    positionIndex: 0,
    skipTurns: 0,
    protectedFromBackward: 0
  }));
}

export function updatePlayer(players: Player[], playerId: string, updater: (player: Player) => Player): Player[] {
  return players.map((player) => (player.id === playerId ? updater(player) : player));
}

function getPlayerToken(index: number): PlayerToken {
  return tokenOrder[index] ?? tokenOrder[0];
}

function getPlayerColor(index: number): string {
  return tokenColors[index] ?? tokenColors[0];
}
