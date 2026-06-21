export const MIN_PLAYERS = 2;
export const MAX_PLAYERS = 4;
export const START_POSITION = 0;
export const PLAYABLE_SPACE_COUNT = 110;
export const WIN_POSITION = PLAYABLE_SPACE_COUNT;
export const DICE_MIN = 1;
export const DICE_MAX = 6;

export type MoveReason = 'dice' | 'hit_card' | 'system';

export type ServerMoveResult = {
  fromPosition: number;
  amount: number;
  toPosition: number;
  traversedPositions: number[];
  crossedFinish: boolean;
  reason: MoveReason;
};

export function normalizePlayerName(input: string | undefined, fallback: string): string {
  if (!input) return fallback;
  const cleaned = input.replace(/\s+/g, ' ').trim().slice(0, 18);
  return cleaned.length > 0 ? cleaned : fallback;
}

export function rollSixSidedDie(random: () => number = Math.random): number {
  return Math.floor(random() * DICE_MAX) + DICE_MIN;
}

export function clampBoardPosition(position: number): number {
  if (!Number.isFinite(position)) return START_POSITION;
  return Math.max(START_POSITION, Math.min(Math.trunc(position), WIN_POSITION));
}

export function calculateServerMove(fromPosition: number, amount: number, reason: MoveReason = 'dice'): ServerMoveResult {
  const cleanFrom = clampBoardPosition(fromPosition);
  if (!Number.isInteger(amount)) throw new Error('Move amount must be an integer.');

  const rawTarget = cleanFrom + amount;
  const toPosition = clampBoardPosition(rawTarget);
  const crossedFinish = amount > 0 && cleanFrom < WIN_POSITION && rawTarget >= WIN_POSITION;
  const direction = toPosition >= cleanFrom ? 1 : -1;
  const traversedPositions: number[] = [];

  if (toPosition !== cleanFrom) {
    for (let position = cleanFrom + direction; direction > 0 ? position <= toPosition : position >= toPosition; position += direction) {
      traversedPositions.push(position);
    }
  }

  return { fromPosition: cleanFrom, amount, toPosition, traversedPositions, crossedFinish, reason };
}
