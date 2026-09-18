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

  test('follows one connected route through the seven locked locations in order', () => {
    const expectedZones = [
      'Rolling Hills',
      'Dankwood Forest',
      'Rosin Rail Station',
      'Munchie Mountain',
      'Kief Caves',
      'Trichome Towers',
      'Cloud 9 Citadel'
    ];
    const visitedZones = boardPath
      .filter((space, index) => index === 0 || space.zone !== boardPath[index - 1]?.zone)
      .map((space) => space.zone);

    expect(visitedZones).toEqual(expectedZones);

    boardPath.slice(1).forEach((space, index) => {
      const previous = boardPath[index];
      const centerDistance = Math.hypot(space.x - previous.x, space.y - previous.y);
      expect(centerDistance, `route gap between indexes ${previous.index} and ${space.index}`).toBeLessThanOrEqual(90);
    });
  });

  test('starts and finishes correctly', () => {
    expect(boardPath[0]?.type).toBe('start');
    expect(boardPath[boardPath.length - 1]?.type).toBe('finish');
  });
});