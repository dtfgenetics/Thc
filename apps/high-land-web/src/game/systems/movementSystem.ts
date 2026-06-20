import type { MoveResult } from '../types/gameTypes';

export function clampPosition(index: number, finishIndex: number): number {
  return Math.max(0, Math.min(index, finishIndex));
}

export function calculateMove(fromIndex: number, amount: number, finishIndex: number): MoveResult {
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
