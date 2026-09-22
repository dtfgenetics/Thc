import { describe, expect, it } from 'vitest';
import { createInitialGame } from './gameEngine';
import { buildPathIndexes, buildTokenAnimationPath } from './tokenAnimationSystem';

describe('token animation path system', () => {
  it('enumerates every forward and backward board index in order', () => {
    expect(buildPathIndexes(2, 6)).toEqual([3, 4, 5, 6]);
    expect(buildPathIndexes(6, 2)).toEqual([5, 4, 3, 2]);
    expect(buildPathIndexes(4, 4)).toEqual([]);
  });

  it('uses the exact traversed dice indexes when the final position is the dice landing space', () => {
    const state = createInitialGame(2);
    state.lastMove = {
      playerId: state.players[0].id,
      fromIndex: 3,
      toIndex: 6,
      traversedIndexes: [4, 5, 6]
    };

    expect(buildTokenAnimationPath(state.players[0].id, 3, 6, state)).toEqual([4, 5, 6]);
  });

  it('appends every card-effect index after the dice traversal', () => {
    const state = createInitialGame(2);
    state.lastMove = {
      playerId: state.players[0].id,
      fromIndex: 3,
      toIndex: 6,
      traversedIndexes: [4, 5, 6]
    };

    expect(buildTokenAnimationPath(state.players[0].id, 3, 9, state)).toEqual([4, 5, 6, 7, 8, 9]);
    expect(buildTokenAnimationPath(state.players[0].id, 3, 4, state)).toEqual([4, 5, 6, 5, 4]);
  });

  it('falls back to a complete index-by-index path when no matching dice move exists', () => {
    const state = createInitialGame(2);
    expect(buildTokenAnimationPath(state.players[1].id, 7, 3, state)).toEqual([6, 5, 4, 3]);
  });
});
