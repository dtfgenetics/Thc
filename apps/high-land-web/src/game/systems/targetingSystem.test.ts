import { describe, expect, it } from 'vitest';
import type { Player } from '../types/gameTypes';
import { findPlayerBehind } from './targetingSystem';

function makePlayer(id: string, positionIndex: number): Player {
  return {
    id,
    name: id,
    token: 'tokenA',
    color: '#ffffff',
    positionIndex,
    skipTurns: 0,
    protectedFromBackward: 0
  };
}

describe('targeting system', () => {
  it('does not treat tied players as behind', () => {
    const current = makePlayer('current', 10);
    const tied = makePlayer('tied', 10);
    const behind = makePlayer('behind', 8);

    expect(findPlayerBehind([current, tied, behind], current)?.id).toBe('behind');
  });

  it('returns null when no player is behind', () => {
    const current = makePlayer('current', 10);
    const tied = makePlayer('tied', 10);
    const ahead = makePlayer('ahead', 12);

    expect(findPlayerBehind([current, tied, ahead], current)).toBeNull();
  });
});
