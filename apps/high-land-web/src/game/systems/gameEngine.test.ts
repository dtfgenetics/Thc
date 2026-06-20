import { describe, expect, it } from 'vitest';
import { boardPath, finishIndex } from '../data/boardPath';
import { createInitialGame, rollCurrentTurn } from './gameEngine';
import { rollDie, isValidDieRoll } from './diceSystem';
import { calculateMove } from './movementSystem';
import { applyActionCard } from './cardSystem';
import type { ActionCard } from '../types/gameTypes';

describe('dice system', () => {
  it('rolls from 1 to 6', () => {
    expect(rollDie(() => 0)).toBe(1);
    expect(rollDie(() => 0.999)).toBe(6);
    expect(isValidDieRoll(1)).toBe(true);
    expect(isValidDieRoll(6)).toBe(true);
    expect(isValidDieRoll(0)).toBe(false);
    expect(isValidDieRoll(7)).toBe(false);
  });
});

describe('movement system', () => {
  it('clamps movement at start and finish', () => {
    expect(calculateMove(0, -4, finishIndex).toIndex).toBe(0);
    expect(calculateMove(finishIndex - 1, 10, finishIndex).toIndex).toBe(finishIndex);
  });

  it('returns each traversed index', () => {
    expect(calculateMove(2, 3, finishIndex).traversedIndexes).toEqual([3, 4, 5]);
    expect(calculateMove(5, -2, finishIndex).traversedIndexes).toEqual([4, 3]);
  });
});

describe('board path', () => {
  it('has continuous indexes and coordinates', () => {
    boardPath.forEach((space, index) => {
      expect(space.index).toBe(index);
      expect(Number.isFinite(space.x)).toBe(true);
      expect(Number.isFinite(space.y)).toBe(true);
    });
  });

  it('has start and finish spaces', () => {
    expect(boardPath[0].type).toBe('start');
    expect(boardPath[finishIndex].type).toBe('finish');
  });
});

describe('game engine', () => {
  it('creates 2 to 4 player games', () => {
    expect(createInitialGame(2).players).toHaveLength(2);
    expect(createInitialGame(4).players).toHaveLength(4);
  });

  it('rolls, moves, and advances turns', () => {
    const state = createInitialGame(2);
    const next = rollCurrentTurn(state, () => 0);
    expect(next.lastRoll).toBe(1);
    expect(next.players[0].positionIndex).toBe(1);
    expect(next.currentPlayerIndex).toBe(1);
  });

  it('declares a winner at the final index', () => {
    const state = createInitialGame(2);
    const nearFinish = {
      ...state,
      players: state.players.map((player, index) =>
        index === 0 ? { ...player, positionIndex: finishIndex - 1 } : player
      )
    };
    const next = rollCurrentTurn(nearFinish, () => 0);
    expect(next.phase).toBe('game_over');
    expect(next.winnerId).toBe('player-1');
  });

  it('applies forward and backward card movement', () => {
    const state = createInitialGame(2);
    const forwardCard: ActionCard = {
      id: 'test-forward',
      title: 'Forward',
      text: 'Move ahead.',
      effect: { type: 'move', amount: 4 }
    };
    const backwardCard: ActionCard = {
      id: 'test-backward',
      title: 'Backward',
      text: 'Move back.',
      effect: { type: 'move', amount: -2 }
    };
    const afterForward = applyActionCard(state, forwardCard);
    expect(afterForward.players[0].positionIndex).toBe(4);
    const afterBackward = applyActionCard({ ...afterForward, currentPlayerIndex: 0 }, backwardCard);
    expect(afterBackward.players[0].positionIndex).toBe(2);
  });

  it('applies skip turns', () => {
    const state = createInitialGame(2);
    const skipCard: ActionCard = {
      id: 'test-skip',
      title: 'Skip',
      text: 'Skip next turn.',
      effect: { type: 'skip_turns', amount: 1 }
    };
    const next = applyActionCard(state, skipCard);
    expect(next.players[0].skipTurns).toBe(1);
  });
});
