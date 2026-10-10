import { describe, expect, it } from 'vitest';
import { finishIndex } from '../data/boardPath';
import type { ActionCard } from '../types/gameTypes';
import { applyActionCard } from './cardSystem';
import { createInitialGame } from './gameEngine';

const drawAgain: ActionCard = {
  id: 'chain-cap-test',
  title: 'Draw Again',
  text: 'Draw another card.',
  effect: { type: 'draw_again' }
};

const moveAndDrawAgain: ActionCard = {
  id: 'move-chain-cap-test',
  title: 'Move +3 and Draw',
  text: 'Move forward 3 spaces and draw again.',
  effect: { type: 'move_and_draw_again', amount: 3 }
};

describe('HIT card draw chain cap', () => {
  it('advances the turn when a third consecutive draw-again is capped', () => {
    const state = createInitialGame(2);
    const result = applyActionCard(state, drawAgain, 2, () => 0);
    expect(result.phase).toBe('ready');
    expect(result.currentPlayerIndex).toBe(1);
    expect(result.cardCursor).toBe(state.cardCursor);
    expect(result.message).toContain('Draw chain limit reached');
  });

  it('still applies capped move-and-draw effects before passing the turn', () => {
    const state = createInitialGame(2);
    const result = applyActionCard(state, moveAndDrawAgain, 2, () => 0);
    expect(result.players[0].positionIndex).toBe(3);
    expect(result.currentPlayerIndex).toBe(1);
  });

  it('preserves the winner when a capped move reaches FINISH', () => {
    const state = createInitialGame(2);
    state.players[0].positionIndex = finishIndex - 1;
    const result = applyActionCard(state, moveAndDrawAgain, 2, () => 0);
    expect(result.winnerId).toBe(state.players[0].id);
    expect(result.phase).toBe('game_over');
    expect(result.currentPlayerIndex).toBe(0);
  });

  it('keeps reversed turn order when the draw cap consumes a reversed turn', () => {
    const state = { ...createInitialGame(4), turnDirection: -1 as const, reverseTurnsRemaining: 2 };
    const result = applyActionCard(state, drawAgain, 2, () => 0);
    expect(result.turnDirection).toBe(-1);
    expect(result.reverseTurnsRemaining).toBe(1);
    expect(result.currentPlayerIndex).toBe(3);
  });

  it('restores forward order when the capped draw consumes the last reversed turn', () => {
    const state = { ...createInitialGame(4), turnDirection: -1 as const, reverseTurnsRemaining: 1 };
    const result = applyActionCard(state, drawAgain, 2, () => 0);
    expect(result.turnDirection).toBe(1);
    expect(result.reverseTurnsRemaining).toBe(0);
    expect(result.currentPlayerIndex).toBe(1);
  });
});
