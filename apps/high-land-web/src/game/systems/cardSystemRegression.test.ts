import { describe, expect, it } from 'vitest';
import { finishIndex } from '../data/boardPath';
import type { ActionCard } from '../types/gameTypes';
import { applyActionCard } from './cardSystem';
import { createInitialGame } from './gameEngine';

describe('card system regression checks', () => {
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
