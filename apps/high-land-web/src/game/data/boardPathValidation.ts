import type { BoardSpace } from '../types/gameTypes';
import { approvedBoardSpaceCount, approvedHitSpaceCount } from './boardPath';

export const boardCanvasWidth = 800;
export const boardCanvasHeight = 900;

export function validateBoardPath(path: BoardSpace[]): string[] {
  const errors: string[] = [];

  if (path.length !== approvedBoardSpaceCount) {
    errors.push(`Expected ${approvedBoardSpaceCount} spaces, found ${path.length}.`);
  }

  const hitCount = path.filter((space) => space.type === 'action' && space.action === 'draw_hit_card').length;
  if (hitCount !== approvedHitSpaceCount) {
    errors.push(`Expected ${approvedHitSpaceCount} action spaces, found ${hitCount}.`);
  }

  path.forEach((space, expectedIndex) => {
    if (space.index !== expectedIndex) {
      errors.push(`Space index mismatch. Expected ${expectedIndex}, found ${space.index}.`);
    }

    if (!Number.isFinite(space.x) || !Number.isFinite(space.y)) {
      errors.push(`Space ${space.index} has invalid center coordinates.`);
    }

    if (!Number.isFinite(space.bounds.x) || !Number.isFinite(space.bounds.y)) {
      errors.push(`Space ${space.index} has invalid bounds origin.`);
    }

    if (!Number.isFinite(space.bounds.width) || !Number.isFinite(space.bounds.height)) {
      errors.push(`Space ${space.index} has invalid bounds size.`);
    }

    if (space.bounds.width <= 0 || space.bounds.height <= 0) {
      errors.push(`Space ${space.index} must have positive bounds.`);
    }

    if (space.x < 0 || space.x > boardCanvasWidth || space.y < 0 || space.y > boardCanvasHeight) {
      errors.push(`Space ${space.index} center is outside the board canvas.`);
    }

    if (space.bounds.x < 0 || space.bounds.y < 0) {
      errors.push(`Space ${space.index} bounds start outside the board canvas.`);
    }

    if (space.bounds.x + space.bounds.width > boardCanvasWidth) {
      errors.push(`Space ${space.index} bounds exceed board width.`);
    }

    if (space.bounds.y + space.bounds.height > boardCanvasHeight) {
      errors.push(`Space ${space.index} bounds exceed board height.`);
    }

    if (space.type === 'action' && space.action !== 'draw_hit_card') {
      errors.push(`Space ${space.index} is an action space without an explicit action.`);
    }

    if (space.action === 'draw_hit_card' && space.type !== 'action') {
      errors.push(`Space ${space.index} has an action but is not typed as an action space.`);
    }
  });

  if (path[0]?.type !== 'start') {
    errors.push('Space 0 must be the start space.');
  }

  if (path[path.length - 1]?.type !== 'finish') {
    errors.push('Final space must be the finish space.');
  }

  return errors;
}

export function assertValidBoardPath(path: BoardSpace[]): void {
  const errors = validateBoardPath(path);
  if (errors.length > 0) {
    throw new Error(`Invalid High Land board path:\n${errors.join('\n')}`);
  }
}