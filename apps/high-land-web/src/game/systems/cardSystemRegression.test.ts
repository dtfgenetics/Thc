import { describe, expect, it } from 'vitest';
import { starterActionCards } from '../data/actionCards';
import { finishIndex } from '../data/boardPath';
import type { ActionCard } from '../types/gameTypes';
import { applyActionCard } from './cardSystem';
import { createInitialGame } from './gameEngine';

describe('card system regression checks', () => {
  it('keeps the authored 31-card HIT deck intact', () => {
    const ids = starterActionCards.map((card) => card.id);
    expect(starterActionCards).toHaveLength(31);
    expect(new Set(ids).size).toBe(ids.length);
    expect(starterActionCards.every((card) => card.art)).toBe(true);
  });

  it('keeps roll-again card wording aligned with its reaction', () => {
    const rollAgainCards = starterActionCards.filter((card) => card.effect.type === 'roll_again');
    expect(rollAgainCards).toHaveLength(1);
    expect(rollAgainCards[0].text).toBe('Take another roll before the turn passes.');
  });

  it('chains a draw-again card into the next deck card', () => {
    const state = createInitialGame(2);
    const card: ActionCard = {
      id: 'test-draw-again',
      title: 'Draw Again',
      text: 'Draw another card.',
      effect: { type: 'draw_again' }
    };

    const next = applyActionCard(state, card);

    expect(next.players[0].positionIndex).toBe(3);
    expect(next.cardCursor).toBe(1);
  });

  it('moves before chaining a move-and-draw-again card', () => {
    const state = createInitialGame(2);
    const card: ActionCard = {
      id: 'test-move-draw-again',
      title: 'Move and Draw Again',
      text: 'Move then draw.',
      effect: { type: 'move_and_draw_again', amount: 2 }
    };

    const next = applyActionCard(state, card);

    expect(next.players[0].positionIndex).toBe(5);
    expect(next.cardCursor).toBe(1);
    expect(next.lastCard?.id).toBe('perfect-roll');
  });

  it('finds a winner after group movement', () => {
    const state = createInitialGame(2);
    const card: ActionCard = {
      id: 'test-group-move',
      title: 'Move Everyone',
      text: 'Everyone moves.',
      effect: { type: 'move_all', amount: 1, filter: 'everyone' }
    };

    const nearFinish = {
      ...state,
      players: state.players.map((player, index) =>
        index === 1 ? { ...player, positionIndex: finishIndex - 1 } : player
      )
    };

    const next = applyActionCard(nearFinish, card);

    expect(next.phase).toBe('game_over');
    expect(next.winnerId).toBe('player-2');
  });
});
