import { starterActionCards } from '../data/actionCards';
import type { ActionCard, GameState } from '../types/gameTypes';
import { resolveActionCard } from './effectResolver';

export function drawActionCard(cardCursor: number, deck: ActionCard[] = starterActionCards): { card: ActionCard; nextCursor: number } {
  if (deck.length === 0) throw new Error('Action card deck is empty.');
  const card = deck[cardCursor % deck.length];
  return { card, nextCursor: cardCursor + 1 };
}

export function applyActionCard(state: GameState, card: ActionCard): GameState {
  return resolveActionCard(state, card);
}
