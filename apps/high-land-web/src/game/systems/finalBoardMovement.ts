export const PLAYABLE_SPACE_COUNT = 110;
export const START_POSITION = 0;
export const FIRST_PLAYABLE_POSITION = 1;
export const WIN_POSITION = PLAYABLE_SPACE_COUNT;
export const DICE_MIN = 1;
export const DICE_MAX = 6;

export type MoveReason = 'dice' | 'hit_card' | 'system';

export type BoardPoint = {
  /** 1 through 110. Position 0 is not a board square; it is the invisible start staging box. */
  position: number;
  x: number;
  y: number;
  type?: 'normal' | 'hit' | 'finish';
  location?:
    | 'Rolling Hills'
    | 'Dankwood Forest'
    | 'Rosin Rail Station'
    | 'Munchie Mountain'
    | 'Kief Caves'
    | 'Trichome Towers'
    | 'Cloud 9 Citadel';
};

export type AnchorPoint = {
  x: number;
  y: number;
};

export type BoardMove = {
  fromPosition: number;
  amount: number;
  toPosition: number;
  traversedPositions: number[];
  crossedFinish: boolean;
  reason: MoveReason;
};

export type TokenSlot = {
  playerId: string;
  position: number;
  slotIndex: number;
  slotCount: number;
  x: number;
  y: number;
};

export type NamedPlayerInput = {
  id: string;
  name: string;
  position: number;
};

export function assertValidBoardMap(boardPoints: readonly BoardPoint[]): void {
  if (boardPoints.length !== PLAYABLE_SPACE_COUNT) {
    throw new Error(`High Land board map must contain exactly ${PLAYABLE_SPACE_COUNT} playable spaces. Received ${boardPoints.length}.`);
  }

  boardPoints.forEach((point, arrayIndex) => {
    const expectedPosition = arrayIndex + FIRST_PLAYABLE_POSITION;
    if (point.position !== expectedPosition) {
      throw new Error(`Board point at array index ${arrayIndex} must be position ${expectedPosition}. Received ${point.position}.`);
    }
    if (!Number.isFinite(point.x) || !Number.isFinite(point.y)) {
      throw new Error(`Board position ${point.position} has invalid coordinates.`);
    }
  });
}

export function normalizePlayerName(input: string, fallback: string): string {
  const cleaned = input.replace(/\s+/g, ' ').trim().slice(0, 18);
  return cleaned.length > 0 ? cleaned : fallback;
}

export function isValidDiceRoll(value: number): boolean {
  return Number.isInteger(value) && value >= DICE_MIN && value <= DICE_MAX;
}

export function clampBoardPosition(position: number): number {
  if (!Number.isFinite(position)) return START_POSITION;
  return Math.max(START_POSITION, Math.min(Math.trunc(position), WIN_POSITION));
}

/**
 * Core High Land movement rule.
 * Players begin at position 0 in the invisible start staging box.
 * A roll of 6 from START traverses [1,2,3,4,5,6] and lands on 6.
 * Winning does not require a perfect roll. Any forward move that reaches or passes 110 wins.
 */
export function calculateFinalBoardMove(fromPosition: number, amount: number, reason: MoveReason = 'dice'): BoardMove {
  const cleanFrom = clampBoardPosition(fromPosition);
  if (!Number.isInteger(amount)) {
    throw new Error(`Move amount must be an integer. Received ${amount}.`);
  }

  const rawTarget = cleanFrom + amount;
  const crossedFinish = amount > 0 && cleanFrom < WIN_POSITION && rawTarget >= WIN_POSITION;
  const toPosition = clampBoardPosition(rawTarget);
  const direction = toPosition >= cleanFrom ? 1 : -1;
  const traversedPositions: number[] = [];

  if (toPosition !== cleanFrom) {
    for (let position = cleanFrom + direction; direction > 0 ? position <= toPosition : position >= toPosition; position += direction) {
      traversedPositions.push(position);
    }
  }

  return {
    fromPosition: cleanFrom,
    amount,
    toPosition,
    traversedPositions,
    crossedFinish,
    reason
  };
}

export function getBoardAnchor(position: number, boardPoints: readonly BoardPoint[], startAnchor: AnchorPoint): AnchorPoint {
  if (position <= START_POSITION) return startAnchor;
  const point = boardPoints[position - 1] ?? boardPoints[boardPoints.length - 1];
  if (!point) return startAnchor;
  return { x: point.x, y: point.y };
}

const slotOffsetTable: Record<number, readonly AnchorPoint[]> = {
  1: [{ x: 0, y: 0 }],
  2: [{ x: -7, y: 0 }, { x: 7, y: 0 }],
  3: [{ x: 0, y: -7 }, { x: -7, y: 6 }, { x: 7, y: 6 }],
  4: [{ x: -7, y: -7 }, { x: 7, y: -7 }, { x: -7, y: 7 }, { x: 7, y: 7 }]
};

function buildCompactGridOffsets(count: number): AnchorPoint[] {
  const columns = count > 8 ? 5 : 4;
  const rows = Math.ceil(count / columns);
  const xSpacing = count > 8 ? 7 : 8;
  const ySpacing = rows > 2 ? 7 : 8;

  return Array.from({ length: count }, (_, index) => {
    const row = Math.floor(index / columns);
    const itemsInThisRow = Math.min(columns, count - row * columns);
    const column = index % columns;
    const x = Math.round((column - (itemsInThisRow - 1) / 2) * xSpacing);
    const y = Math.round((row - (rows - 1) / 2) * ySpacing);
    return { x, y };
  });
}

export function getTokenOffsetsForOccupancy(count: number): AnchorPoint[] {
  if (!Number.isInteger(count) || count < 1) return [{ x: 0, y: 0 }];
  if (count <= 4) return [...(slotOffsetTable[count] ?? slotOffsetTable[1])];
  return buildCompactGridOffsets(count);
}

export function getTokenRadiusForOccupancy(count: number): number {
  if (count <= 1) return 8;
  if (count <= 4) return 6;
  if (count <= 8) return 4.5;
  return 3.8;
}

/**
 * Keeps pieces inside the current square instead of floating beside the board.
 * This supports a crowded same-square stack up to the current app maximum of 10 players.
 */
export function buildTokenSlots(
  players: readonly NamedPlayerInput[],
  boardPoints: readonly BoardPoint[],
  startAnchor: AnchorPoint
): TokenSlot[] {
  const grouped = new Map<number, NamedPlayerInput[]>();
  players.forEach((player) => {
    const position = clampBoardPosition(player.position);
    const group = grouped.get(position) ?? [];
    group.push({ ...player, position });
    grouped.set(position, group);
  });

  const slots: TokenSlot[] = [];
  grouped.forEach((group, position) => {
    const sorted = [...group].sort((a, b) => a.id.localeCompare(b.id));
    const offsets = getTokenOffsetsForOccupancy(sorted.length);
    const anchor = getBoardAnchor(position, boardPoints, startAnchor);

    sorted.forEach((player, index) => {
      const offset = offsets[index] ?? { x: 0, y: 0 };
      slots.push({
        playerId: player.id,
        position,
        slotIndex: index,
        slotCount: sorted.length,
        x: anchor.x + offset.x,
        y: anchor.y + offset.y
      });
    });
  });

  return slots;
}

export function landedOnHit(position: number, boardPoints: readonly BoardPoint[]): boolean {
  if (position <= START_POSITION || position > WIN_POSITION) return false;
  return boardPoints[position - 1]?.type === 'hit';
}
