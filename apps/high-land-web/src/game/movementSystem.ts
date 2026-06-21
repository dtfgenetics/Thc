import { BOARD_SPACES, FINISH_POSITION, START_POSITION, getBoardSpace } from './boardPath';
import type { MoveRequest, MoveResult } from './types';

export function assertDiceRoll(roll: number): void {
  if (!Number.isInteger(roll) || roll < 1 || roll > 6) {
    throw new Error(`Dice roll must be an integer from 1 to 6. Received: ${roll}`);
  }
}

export function clampBoardPosition(position: number): number {
  if (!Number.isFinite(position)) return START_POSITION;
  return Math.max(START_POSITION, Math.min(FINISH_POSITION, Math.trunc(position)));
}

export function buildStepSequence(from: number, to: number): number[] {
  if (from === to) return [];

  const direction = to > from ? 1 : -1;
  const sequence: number[] = [];

  for (let position = from + direction; direction > 0 ? position <= to : position >= to; position += direction) {
    sequence.push(position);
  }

  return sequence;
}

export function moveByAmount(request: MoveRequest): MoveResult {
  const from = clampBoardPosition(request.from);
  const to = clampBoardPosition(from + request.amount);
  const landedSpace = getBoardSpace(to);
  const hitTriggered = request.reason === 'dice' && landedSpace?.type === 'hit';

  return {
    from,
    to,
    amount: request.amount,
    reason: request.reason,
    stepSequence: buildStepSequence(from, to),
    landedSpace,
    hitTriggered,
    won: to === FINISH_POSITION,
  };
}

export function moveByDice(from: number, roll: number): MoveResult {
  assertDiceRoll(roll);
  return moveByAmount({ from, amount: roll, reason: 'dice' });
}

export function moveByCard(from: number, amount: number): MoveResult {
  return moveByAmount({ from, amount, reason: 'card' });
}

export function getPlayableSpaceCount(): number {
  return BOARD_SPACES.length;
}
