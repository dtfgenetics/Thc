import { describe, expect, it } from 'vitest';
import {
  PLAYABLE_SPACE_COUNT,
  START_POSITION,
  WIN_POSITION,
  assertValidBoardMap,
  buildTokenSlots,
  calculateFinalBoardMove,
  getBoardAnchor,
  getTokenOffsetsForOccupancy,
  getTokenRadiusForOccupancy,
  isValidDiceRoll,
  normalizePlayerName,
  type BoardPoint
} from './finalBoardMovement';

const boardPoints: BoardPoint[] = Array.from({ length: PLAYABLE_SPACE_COUNT }, (_, index) => ({
  position: index + 1,
  x: 100 + index * 10,
  y: 200,
  type: index + 1 === WIN_POSITION ? 'finish' : index + 1 === 6 ? 'hit' : 'normal'
}));

describe('final High Land board movement contract', () => {
  it('requires exactly 110 playable spaces', () => {
    expect(() => assertValidBoardMap(boardPoints)).not.toThrow();
    expect(() => assertValidBoardMap(boardPoints.slice(0, 109))).toThrow(/exactly 110/);
  });

  it('starts players before the first square and lands a roll of six on the sixth square', () => {
    const move = calculateFinalBoardMove(START_POSITION, 6, 'dice');
    expect(move.toPosition).toBe(6);
    expect(move.traversedPositions).toEqual([1, 2, 3, 4, 5, 6]);
    expect(move.crossedFinish).toBe(false);
  });

  it('does not require a perfect roll to win', () => {
    const move = calculateFinalBoardMove(108, 6, 'dice');
    expect(move.toPosition).toBe(WIN_POSITION);
    expect(move.crossedFinish).toBe(true);
    expect(move.traversedPositions).toEqual([109, 110]);
  });

  it('does not mark an already-finished player as newly crossing finish on a backward move', () => {
    const move = calculateFinalBoardMove(WIN_POSITION, -2, 'hit_card');
    expect(move.toPosition).toBe(108);
    expect(move.crossedFinish).toBe(false);
  });

  it('moves backward from HIT cards without going below the invisible start box', () => {
    const move = calculateFinalBoardMove(3, -8, 'hit_card');
    expect(move.toPosition).toBe(0);
    expect(move.traversedPositions).toEqual([2, 1, 0]);
  });

  it('validates dice values', () => {
    expect(isValidDiceRoll(1)).toBe(true);
    expect(isValidDiceRoll(6)).toBe(true);
    expect(isValidDiceRoll(0)).toBe(false);
    expect(isValidDiceRoll(7)).toBe(false);
    expect(isValidDiceRoll(3.5)).toBe(false);
  });

  it('normalizes player names instead of leaving placeholder-only identities', () => {
    expect(normalizePlayerName('  Rosin Rocket  ', 'Player 1')).toBe('Rosin Rocket');
    expect(normalizePlayerName('   ', 'Player 1')).toBe('Player 1');
  });

  it('uses the playable finish square as the board anchor for position 110', () => {
    expect(getBoardAnchor(WIN_POSITION, boardPoints, { x: 10, y: 10 })).toEqual({ x: boardPoints[109].x, y: boardPoints[109].y });
  });

  it('keeps four players on the same square in small slots inside that square', () => {
    const slots = buildTokenSlots(
      [
        { id: 'p1', name: 'A', position: 6 },
        { id: 'p2', name: 'B', position: 6 },
        { id: 'p3', name: 'C', position: 6 },
        { id: 'p4', name: 'D', position: 6 }
      ],
      boardPoints,
      { x: 10, y: 10 }
    );

    expect(slots).toHaveLength(4);
    expect(new Set(slots.map((slot) => `${slot.x},${slot.y}`)).size).toBe(4);
    slots.forEach((slot) => {
      expect(Math.abs(slot.x - boardPoints[5].x)).toBeLessThanOrEqual(7);
      expect(Math.abs(slot.y - boardPoints[5].y)).toBeLessThanOrEqual(7);
    });
  });

  it('supports crowded same-space token slots without stacking every extra player on one point', () => {
    const offsets = getTokenOffsetsForOccupancy(10);
    expect(offsets).toHaveLength(10);
    expect(new Set(offsets.map((offset) => `${offset.x},${offset.y}`)).size).toBe(10);
    offsets.forEach((offset) => {
      expect(Math.abs(offset.x)).toBeLessThanOrEqual(14);
      expect(Math.abs(offset.y)).toBeLessThanOrEqual(7);
    });
    expect(getTokenRadiusForOccupancy(10)).toBeLessThanOrEqual(3.8);
  });
});
