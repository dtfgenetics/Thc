import { describe, expect, it } from 'vitest';
import { boardPath } from '../data/boardPath';
import { validateBoardPathCoordinates } from './boardCoordinateValidator';

describe('board coordinate validator', () => {
  it('accepts the current High Land board path', () => {
    const result = validateBoardPathCoordinates(boardPath);
    expect(result.errors).toEqual([]);
    expect(result.valid).toBe(true);
  });

  it('rejects out-of-bounds spaces', () => {
    const brokenPath = boardPath.map((space) => ({ ...space }));
    brokenPath[1] = { ...brokenPath[1], x: 9999 };

    const result = validateBoardPathCoordinates(brokenPath);
    expect(result.valid).toBe(false);
    expect(result.errors.join('\n')).toContain('outside');
  });
});
