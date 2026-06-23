import { boardPath, finishIndex } from '../data/boardPath';
import type { Player, SpaceColor } from '../types/gameTypes';

export function findNextColorSpace(fromIndex: number, color: SpaceColor): number | null {
  for (let index = fromIndex + 1; index <= finishIndex; index += 1) {
    if (boardPath[index]?.color === color) return index;
  }
  return null;
}

export function findPreviousColorSpace(fromIndex: number, color: SpaceColor): number | null {
  for (let index = fromIndex - 1; index >= 0; index -= 1) {
    if (boardPath[index]?.color === color) return index;
  }
  return null;
}

export function findLeader(players: Player[]): Player | null {
  return [...players].sort((a, b) => b.positionIndex - a.positionIndex)[0] ?? null;
}

export function findLastPlace(players: Player[]): Player | null {
  return [...players].sort((a, b) => a.positionIndex - b.positionIndex)[0] ?? null;
}

export function findPlayerBehind(players: Player[], currentPlayer: Player): Player | null {
  return [...players]
    .filter((player) => player.id !== currentPlayer.id && player.positionIndex < currentPlayer.positionIndex)
    .sort((a, b) => b.positionIndex - a.positionIndex)[0] ?? null;
}

export function filterPlayersForGroupMove(players: Player[], currentPlayer: Player, filter: 'everyone' | 'except_current' | 'ahead' | 'behind'): Player[] {
  if (filter === 'everyone') return players;
  if (filter === 'except_current') return players.filter((player) => player.id !== currentPlayer.id);
  if (filter === 'ahead') return players.filter((player) => player.positionIndex > currentPlayer.positionIndex);
  return players.filter((player) => player.positionIndex < currentPlayer.positionIndex);
}
