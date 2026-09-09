import type { Player, TurnDirection } from '../types/gameTypes';

export type ReverseTurnCounterState = {
  turnDirection: TurnDirection;
  reverseTurnsRemaining: number;
};

export function getCurrentPlayer(players: Player[], currentPlayerIndex: number): Player {
  const player = players[currentPlayerIndex];
  if (!player) throw new Error('Current player index is invalid.');
  return player;
}

export function nextPlayerIndex(players: Player[], currentPlayerIndex: number, direction: TurnDirection = 1): number {
  if (players.length === 0) return 0;
  return (currentPlayerIndex + direction + players.length) % players.length;
}

export function reduceReverseTurnCounter(state: ReverseTurnCounterState): ReverseTurnCounterState {
  if (state.reverseTurnsRemaining <= 0) {
    return { turnDirection: state.turnDirection, reverseTurnsRemaining: 0 };
  }

  const remaining = state.reverseTurnsRemaining - 1;
  const turnDirection: TurnDirection = remaining <= 0 ? 1 : state.turnDirection;
  return { turnDirection, reverseTurnsRemaining: remaining };
}

export function shouldSkipTurn(player: Player): boolean {
  return player.skipTurns > 0;
}
