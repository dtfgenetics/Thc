import type { Player, TurnDirection } from '../types/gameTypes';

export function getCurrentPlayer(players: Player[], currentPlayerIndex: number): Player {
  const player = players[currentPlayerIndex];
  if (!player) throw new Error('Current player index is invalid.');
  return player;
}

export function nextPlayerIndex(players: Player[], currentPlayerIndex: number, direction: TurnDirection = 1): number {
  if (players.length === 0) return 0;
  return (currentPlayerIndex + direction + players.length) % players.length;
}

export function shouldSkipTurn(player: Player): boolean {
  return player.skipTurns > 0;
}
