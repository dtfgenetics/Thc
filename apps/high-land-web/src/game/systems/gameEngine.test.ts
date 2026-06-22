import { describe, expect, it } from 'vitest';
import { boardPath, finishIndex } from '../data/boardPath';
import type { ActionCard } from '../types/gameTypes';
import { applyActionCard } from './cardSystem';
import { rollDie } from './diceSystem';
import { calculateMove } from './movementSystem';
import { createInitialGame, rollCurrentTurn } from './gameEngine';

function buildStateAt(positionIndex: number) {
  const state = createInitialGame(2);
  return {
    ...state,
    players: state.players.map((player, index) => (index === 0 ? { ...player, positionIndex } : player))
  };
}

describe('game engine', () => {
  it('rolls from 1 to 6', () => {
    expect(rollDie(() => 0)).toBe(1);
    expect(rollDie(() => 0.99)).toBe(6);
  });

  it('clamps movement at start and finish', () => {
    expect(calculateMove(0, -3, finishIndex).toIndex).toBe(0);
    expect(calculateMove(finishIndex - 1, 10, finishIndex).toIndex).toBe(finishIndex);
  });

  it('returns each traversed index', () => {
    expect(calculateMove(2, 3, finishIndex).traversedIndexes).toEqual([3, 4, 5]);
    expect(calculateMove(5, -2, finishIndex).traversedIndexes).toEqual([4, 3]);
  });

  it('has continuous indexes and coordinates', () => {
    boardPath.forEach((space, index) => {
      expect(space.index).toBe(index);
      expect(space.x).toBeGreaterThanOrEqual(0);
      expect(space.y).toBeGreaterThanOrEqual(0);
    });
  });

  it('has start and finish spaces', () => {
    expect(boardPath[0].type).toBe('start');
    expect(boardPath[finishIndex].type).toBe('finish');
  });

  it('creates 2 to 10 player games', () => {
    expect(createInitialGame(2).players).toHaveLength(2);
    expect(createInitialGame(10).players).toHaveLength(10);
  });

  it('rejects invalid player counts', () => {
    expect(() => createInitialGame(1)).toThrow('Player count must be between 2 and 10.');
    expect(() => createInitialGame(11)).toThrow('Player count must be between 2 and 10.');
  });

  it('rolls, moves, and advances turns', () => {
    const state = createInitialGame(3);
    const next = rollCurrentTurn(state, () => 0);

    expect(next.players[0].positionIndex).toBe(1);
    expect(next.currentPlayerIndex).toBe(1);
    expect(next.lastRoll).toBe(1);
  });

  it('declares a winner at the final index', () => {
    const state = buildStateAt(finishIndex - 1);
    const next = rollCurrentTurn(state, () => 0);

    expect(next.phase).toBe('game_over');
    expect(next.winnerId).toBe('player-1');
  });

  it('applies forward and backward card movement', () => {
    const state = buildStateAt(5);
    const forwardCard: ActionCard = {
      id: 'test-forward',
      title: 'Forward',
      text: 'Move forward.',
      effect: { type: 'move', amount: 3 }
    };
    const backwardCard: ActionCard = {
      id: 'test-backward',
      title: 'Backward',
      text: 'Move backward.',
      effect: { type: 'move', amount: -2 }
    };

    const afterForward = applyActionCard(state, forwardCard);
    expect(afterForward.players[0].positionIndex).toBe(8);
    expect(afterForward.currentPlayerIndex).toBe(1);

    const samePlayerTurn = { ...afterForward, currentPlayerIndex: 0 };
    const afterBackward = applyActionCard(samePlayerTurn, backwardCard);
    expect(afterBackward.players[0].positionIndex).toBe(6);
  });

  it('applies skip turns', () => {
    const state = createInitialGame(2);
    const skipCard: ActionCard = {
      id: 'test-skip',
      title: 'Skip',
      text: 'Skip next turn.',
      effect: { type: 'skip_turns', amount: 1 }
    };

    const skipped = applyActionCard(state, skipCard);
    expect(skipped.players[0].skipTurns).toBe(1);
    expect(skipped.currentPlayerIndex).toBe(1);

    const skippedPlayerTurn = { ...skipped, currentPlayerIndex: 0 };
    const next = rollCurrentTurn(skippedPlayerTurn);
    expect(next.players[0].skipTurns).toBe(0);
    expect(next.currentPlayerIndex).toBe(1);
  });

  it('protects from backward movement once', () => {
    const state = buildStateAt(5);
    const protectCard: ActionCard = {
      id: 'test-protect',
      title: 'Protect',
      text: 'Block backward move.',
      effect: { type: 'protect_from_backward', uses: 1 }
    };
    const backwardCard: ActionCard = {
      id: 'test-backward',
      title: 'Backward',
      text: 'Move backward.',
      effect: { type: 'move', amount: -2 }
    };

    const protectedState = applyActionCard(state, protectCard);
    const advanced = { ...protectedState, players: protectedState.players.map((player, index) => (index === 0 ? { ...player, positionIndex: 8 } : player)) };
    const afterBackward = applyActionCard({ ...advanced, currentPlayerIndex: 0 }, backwardCard);
    expect(afterBackward.players[0].positionIndex).toBe(8);
    expect(afterBackward.players[0].protectedFromBackward).toBe(0);
  });

  it('supports moving to the next matching color', () => {
    const state = createInitialGame(2);
    const colorCard: ActionCard = {
      id: 'test-color',
      title: 'Color Move',
      text: 'Move to next green.',
      effect: { type: 'move_to_color', color: 'green', direction: 'next' }
    };
    const next = applyActionCard(state, colorCard);
    expect(boardPath[next.players[0].positionIndex].color).toBe('green');
  });

  it('supports reverse turn order', () => {
    const state = createInitialGame(3);
    const reverseCard: ActionCard = {
      id: 'test-reverse',
      title: 'Reverse',
      text: 'Reverse turns.',
      effect: { type: 'reverse_turn_order', turns: 2 }
    };
    const reversed = applyActionCard(state, reverseCard);
    expect(reversed.turnDirection).toBe(-1);
    expect(reversed.reverseTurnsRemaining).toBe(2);
    expect(reversed.currentPlayerIndex).toBe(2);

    const next = rollCurrentTurn(reversed, () => 0);
    expect(next.currentPlayerIndex).toBe(1);
    expect(next.reverseTurnsRemaining).toBe(1);
  });
});
