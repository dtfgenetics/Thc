import { describe, expect, it } from 'vitest';
import { actionSpaceIndexes, finishIndex } from '../game/data/boardPath';
import { createInitialGame, rollCurrentTurn } from '../game/systems/gameEngine';
import { describeDiceMove } from './turnFeedback';

function randomForRoll(roll: number): () => number {
  return () => (roll - 1) / 6 + 0.01;
}

describe('High Land dice feedback', () => {
  it('reports the actual traversed board distance', () => {
    const next = rollCurrentTurn(createInitialGame(2), randomForRoll(3));

    expect(next.lastRoll).toBe(3);
    expect(next.lastMove?.traversedIndexes).toHaveLength(3);
    expect(describeDiceMove('Player 1', next)).toBe('Player 1 rolled 3. Moved 3 spaces to space 4.');
  });

  it('reports a shorter move when a roll is clamped at FINISH', () => {
    const state = createInitialGame(2);
    state.players[0] = { ...state.players[0], positionIndex: finishIndex - 1 };
    const next = rollCurrentTurn(state, randomForRoll(6));

    expect(next.lastRoll).toBe(6);
    expect(next.lastMove?.traversedIndexes).toHaveLength(1);
    expect(describeDiceMove('Player 1', next)).toBe(
      'Player 1 rolled 6. Moved 1 space to FINISH; the board ended before all 6 rolled spaces were needed.'
    );
  });

  it('keeps dice movement separate from the HIT card movement that follows', () => {
    const hitIndex = actionSpaceIndexes[0];
    const state = createInitialGame(2);
    state.players[0] = { ...state.players[0], positionIndex: hitIndex - 1 };
    let calls = 0;
    const next = rollCurrentTurn(state, () => (calls++ === 0 ? 0 : 0.75));

    expect(next.lastRoll).toBe(1);
    expect(next.lastMove?.toIndex).toBe(hitIndex);
    expect(next.lastMove?.traversedIndexes).toHaveLength(1);
    expect(next.players[0].positionIndex).not.toBe(hitIndex);
    expect(describeDiceMove('Player 1', next)).toContain('rolled 1. Moved 1 space to HIT.');
    expect(describeDiceMove('Player 1', next)).toContain('HIT card effect applies after the dice move.');
  });
});
