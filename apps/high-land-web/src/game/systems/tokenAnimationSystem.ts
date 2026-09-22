import type { GameState } from '../types/gameTypes';

export function buildTokenAnimationPath(
  playerId: string,
  fromIndex: number,
  finalIndex: number,
  state: GameState
): number[] {
  const lastMove = state.lastMove;
  if (lastMove?.playerId !== playerId || lastMove.fromIndex !== fromIndex) {
    return buildPathIndexes(fromIndex, finalIndex);
  }

  const dicePath = lastMove.traversedIndexes;
  if (lastMove.toIndex === finalIndex) return [...dicePath];
  return [...dicePath, ...buildPathIndexes(lastMove.toIndex, finalIndex)];
}

export function buildPathIndexes(fromIndex: number, toIndex: number): number[] {
  if (fromIndex === toIndex) return [];
  const step = toIndex > fromIndex ? 1 : -1;
  const indexes: number[] = [];

  for (let index = fromIndex + step; step > 0 ? index <= toIndex : index >= toIndex; index += step) {
    indexes.push(index);
  }

  return indexes;
}
