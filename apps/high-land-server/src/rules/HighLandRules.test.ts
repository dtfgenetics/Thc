import { describe, expect, it } from 'vitest';
import { START_POSITION, WIN_POSITION, calculateServerMove, normalizePlayerName, rollSixSidedDie } from './HighLandRules.js';

describe('server High Land rules', () => {
  it('lands a roll of six from start on space six', () => {
    const move = calculateServerMove(START_POSITION, 6, 'dice');
    expect(move.toPosition).toBe(6);
    expect(move.traversedPositions).toEqual([1, 2, 3, 4, 5, 6]);
    expect(move.crossedFinish).toBe(false);
  });

  it('wins by reaching or passing the final space without exact roll', () => {
    const move = calculateServerMove(108, 6, 'dice');
    expect(move.toPosition).toBe(WIN_POSITION);
    expect(move.crossedFinish).toBe(true);
    expect(move.traversedPositions).toEqual([109, 110]);
  });

  it('clamps backward card movement at the invisible start box', () => {
    const move = calculateServerMove(3, -8, 'hit_card');
    expect(move.toPosition).toBe(0);
    expect(move.traversedPositions).toEqual([2, 1, 0]);
  });

  it('normalizes player names', () => {
    expect(normalizePlayerName('  Kief King  ', 'Player 1')).toBe('Kief King');
    expect(normalizePlayerName('', 'Player 1')).toBe('Player 1');
  });

  it('rolls a six-sided die', () => {
    expect(rollSixSidedDie(() => 0)).toBe(1);
    expect(rollSixSidedDie(() => 0.999)).toBe(6);
  });
});
