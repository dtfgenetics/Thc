import type { MoveResult } from '../types/gameTypes';

export function clampPosition(index: number, finishIndex: number): number {
  if (!Number.isSafeInteger(index) || !Number.isSafeInteger(finishIndex) || finishIndex < 0) {
    throw new RangeError('Board positions and finish index must be non-negative safe integers.');
  }
  return Math.max(0, Math.min(index, finishIndex));
}

export function calculateMove(fromIndex: number, amount: number, finishIndex: number): MoveResult {
  if (!Number.isSafeInteger(amount) || !Number.isSafeInteger(fromIndex + amount)) {
    throw new RangeError('Movement amount must be a safe integer within board limits.');
  }
  const toIndex = clampPosition(fromIndex + amount, finishIndex);
  const step = toIndex >= fromIndex ? 1 : -1;
  const traversedIndexes: number[] = [];

  if (fromIndex !== toIndex) {
    for (let index = fromIndex + step; step > 0 ? index <= toIndex : index >= toIndex; index += step) {
      traversedIndexes.push(index);
    }
  }

  return { fromIndex, toIndex, traversedIndexes };
}
