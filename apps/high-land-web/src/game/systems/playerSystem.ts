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

export const playerNames = [
  'Ruby Rider',
  'Blue Dreamer',
  'Green Genie',
  'Golden Glow',
  'Purple Haze',
  'Teal Traveler',
  'Orange Orbit',
  'Pink Puff',
  'Lime Lighter',
  'Sky High'
];

export function createPlayers(count: number): Player[] {
  if (!Number.isInteger(count) || count < minPlayers || count > maxPlayers) {
    throw new Error(`Player count must be between ${minPlayers} and ${maxPlayers}.`);
  }

  return Array.from({ length: count }, (_, index) => ({
    id: `player-${index + 1}`,
    name: playerNames[index],
    token: tokenOrder[index],
    color: tokenColors[index],
    positionIndex: 0,
    skipTurns: 0,
    protectedFromBackward: 0
  }));
}

export function updatePlayer(players: Player[], playerId: string, updater: (player: Player) => Player): Player[] {
  return players.map((player) => (player.id === playerId ? updater(player) : player));
}
