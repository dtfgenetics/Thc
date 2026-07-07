import type { GameState } from '../types/gameTypes';

type HitCardRevealState = Pick<GameState, 'cardCursor' | 'lastCard'>;

/**
 * The cursor advances for every draw, so it distinguishes consecutive draws
 * of the same card while remaining part of the synchronized game state.
 */
export function getHitCardRevealKey(state: HitCardRevealState): string | null {
  if (!state.lastCard) return null;
  return `${state.cardCursor}:${state.lastCard.id}`;
}

export function describeSynchronizedTurn(state: GameState): string | null {
  if (state.lastCard) {
    return `${state.lastCard.title}: ${state.lastCard.text}`;
  }
  return state.message || null;
}
