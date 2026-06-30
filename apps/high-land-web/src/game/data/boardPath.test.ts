import { describe, expect, test } from 'vitest';
import { approvedBoardSpaceCount, approvedHitSpaceCount, boardPath } from './boardPath';
import { validateBoardPath } from './boardPathValidation';

describe('High Land board path', () => {
  test('has the approved number of spaces', () => {
    expect(boardPath).toHaveLength(approvedBoardSpaceCount);
  });

  test('has the approved number of action spaces', () => {
    const hitSpaces = boardPath.filter((space) => space.action === 'draw_hit_card');
    expect(hitSpaces).toHaveLength(approvedHitSpaceCount);
  });

  test('has valid square bounds and coordinates', () => {
    expect(validateBoardPath(boardPath)).toEqual([]);
  });

  test('has continuous indexes', () => {
    boardPath.forEach((space, index) => {
      expect(space.index).toBe(index);
    });
  });

  test('starts and finishes correctly', () => {
    expect(boardPath[0]?.type).toBe('start');
    expect(boardPath[boardPath.length - 1]?.type).toBe('finish');
  });
});