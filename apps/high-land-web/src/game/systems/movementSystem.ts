import type { MoveResult } from '../types/gameTypes';

export function clampPosition(index: number, finishIndex: number): number {
  if (!Number.isSafeInteger(index) || index < 0 || !Number.isSafeInteger(finishIndex) || finishIndex < 0) {
    throw new RangeError('Board positions and finish index must be non-negative safe integers.');
  }
  return Math.max(0, Math.min(index, finishIndex));
}

export function calculateMove(fromIndex: number, amount: number, finishIndex: number): MoveResult {
  if (!Number.isSafeInteger(fromIndex) || fromIndex < 0 ||
      !Number.isSafeInteger(finishIndex) || finishIndex < 0 || fromIndex > finishIndex) {
    throw new RangeError('Starting position and finish index must define a valid board state.');
  }
  if (!Number.isSafeInteger(amount) || !Number.isSafeInteger(fromIndex + amount)) {
    throw new RangeError('Movement amount must be a safe integer within board limits.');
  }
  // Backward cards may overshoot the start: clamp the destination, not the source.
  const toIndex = clampPosition(Math.max(0, fromIndex + amount), finishIndex);
  const step = toIndex >= fromIndex ? 1 : -1;
  const traversedIndexes: number[] = [];

  if (fromIndex !== toIndex) {
    for (let index = fromIndex + step; step > 0 ? index <= toIndex : index >= toIndex; index += step) {
      traversedIndexes.push(index);
    }
  }

  return { fromIndex, toIndex, traversedIndexes };
}
