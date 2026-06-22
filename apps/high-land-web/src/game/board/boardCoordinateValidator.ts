import type { BoardSpace } from '../types/gameTypes';
import { HIGH_LAND_BOARD_BOUNDS, isCoordinateInsideBoard, type BoardRenderBounds } from './boardCalibration';

export type BoardValidationResult = {
  valid: boolean;
  errors: string[];
  warnings: string[];
};

export function validateBoardPathCoordinates(
  boardPath: BoardSpace[],
  bounds: BoardRenderBounds = HIGH_LAND_BOARD_BOUNDS
): BoardValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];
  const seenIndexes = new Set<number>();

  if (boardPath.length < 2) {
    errors.push('Board path must include at least a start and finish space.');
  }

  boardPath.forEach((space, expectedIndex) => {
    if (space.index !== expectedIndex) {
      errors.push(`Board path index mismatch at array position ${expectedIndex}: got ${space.index}.`);
    }

    if (seenIndexes.has(space.index)) {
      errors.push(`Duplicate board path index ${space.index}.`);
    }
    seenIndexes.add(space.index);

    if (!Number.isFinite(space.x) || !Number.isFinite(space.y)) {
      errors.push(`Space ${space.index} has non-finite coordinates.`);
    } else if (!isCoordinateInsideBoard(space, bounds)) {
      errors.push(`Space ${space.index} coordinate (${space.x}, ${space.y}) is outside ${bounds.width}x${bounds.height}.`);
    }

    if (!space.color) warnings.push(`Space ${space.index} has no color.`);
    if (!space.type) warnings.push(`Space ${space.index} has no type.`);
  });

  const start = boardPath[0];
  const finish = boardPath[boardPath.length - 1];

  if (start?.type !== 'start') {
    errors.push('Board path first space must be type start.');
  }

  if (finish?.type !== 'finish') {
    errors.push('Board path final space must be type finish.');
  }

  return {
    valid: errors.length === 0,
    errors,
    warnings
  };
}

export function assertValidBoardPathCoordinates(boardPath: BoardSpace[]): void {
  const result = validateBoardPathCoordinates(boardPath);
  if (!result.valid) {
    throw new Error(result.errors.join('\n'));
  }
}
