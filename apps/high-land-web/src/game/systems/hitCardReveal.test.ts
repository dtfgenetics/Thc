import { describe, expect, it } from 'vitest';
import type { ActionCard } from '../types/gameTypes';
import { describeSynchronizedTurn, getHitCardRevealKey } from './hitCardReveal';
import { createInitialGame } from './gameEngine';

const repeatedCard: ActionCard = {
  id: 'card-001',
  title: 'Perfect Roll',
  text: 'Move forward 3 spaces.',
  effect: { type: 'move', amount: 3 }
};

describe('HIT card reveal state', () => {
  it('creates a new reveal key when the same card is drawn again', () => {
    expect(getHitCardRevealKey({ cardCursor: 1, lastCard: repeatedCard })).toBe('1:card-001');
    expect(getHitCardRevealKey({ cardCursor: 2, lastCard: repeatedCard })).toBe('2:card-001');
  });

  it('does not reveal a card when no card was drawn', () => {
    expect(getHitCardRevealKey({ cardCursor: 0, lastCard: null })).toBeNull();
  });

  it('describes the synchronized instruction after a HIT effect resolves', () => {
    const state = { ...createInitialGame(2), lastCard: repeatedCard };
    expect(describeSynchronizedTurn(state)).toBe('Perfect Roll: Move forward 3 spaces.');
  });
});
