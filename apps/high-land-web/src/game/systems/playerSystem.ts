import type { Player, PlayerToken } from '../types/gameTypes';

const tokenOrder: PlayerToken[] = ['tokenA', 'tokenB', 'tokenC', 'tokenD'];
const tokenColors = ['#f43f5e', '#22c55e', '#3b82f6', '#eab308'];

export function createPlayers(count: number): Player[] {
  if (!Number.isInteger(count) || count < 2 || count > 4) {
    throw new Error('Player count must be between 2 and 4.');
  }

  return Array.from({ length: count }, (_, index) => ({
    id: `player-${index + 1}`,
    name: `Player ${index + 1}`,
    token: tokenOrder[index],
    color: tokenColors[index],
    positionIndex: 0,
    skipTurns: 0
  }));
}

export function updatePlayer(players: Player[], playerId: string, updater: (player: Player) => Player): Player[] {
  return players.map((player) => (player.id === playerId ? updater(player) : player));
}
