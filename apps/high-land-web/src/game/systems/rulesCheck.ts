import { boardPath } from '../data/boardPath';

export function checkBoardPath(): string[] {
  const errors: string[] = [];

  if (boardPath.length < 20) errors.push('Board path is too short.');

  boardPath.forEach((space, index) => {
    if (space.index !== index) errors.push(`Space ${index} has wrong index.`);
    if (!Number.isFinite(space.x) || !Number.isFinite(space.y)) errors.push(`Space ${index} has bad coordinates.`);
  });

  if (boardPath[0]?.type !== 'start') errors.push('First space must be start.');
  if (boardPath[boardPath.length - 1]?.type !== 'finish') errors.push('Last space must be finish.');

  return errors;
}
