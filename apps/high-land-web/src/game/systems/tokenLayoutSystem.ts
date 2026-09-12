export type TokenOffset = {
  x: number;
  y: number;
};

/*
 * Token centers are packed inside the 34px painted road squares. The spacing
 * and radii are paired so colocated tokens remain distinct instead of
 * stacking over one another as the room grows toward 10 players.
 */
const offsetsByPlayerCount: Record<number, TokenOffset[]> = {
  1: [{ x: 0, y: 0 }],
  2: [{ x: -6, y: 0 }, { x: 6, y: 0 }],
  3: [{ x: 0, y: -6 }, { x: -6, y: 6 }, { x: 6, y: 6 }],
  4: [{ x: -6, y: -6 }, { x: 6, y: -6 }, { x: -6, y: 6 }, { x: 6, y: 6 }],
  5: [{ x: -8, y: -5 }, { x: 0, y: -5 }, { x: 8, y: -5 }, { x: -4, y: 5 }, { x: 4, y: 5 }],
  6: [{ x: -8, y: -5 }, { x: 0, y: -5 }, { x: 8, y: -5 }, { x: -8, y: 5 }, { x: 0, y: 5 }, { x: 8, y: 5 }],
  7: [{ x: -10.5, y: -5 }, { x: -3.5, y: -5 }, { x: 3.5, y: -5 }, { x: 10.5, y: -5 }, { x: -7, y: 5 }, { x: 0, y: 5 }, { x: 7, y: 5 }],
  8: [{ x: -10.5, y: -5 }, { x: -3.5, y: -5 }, { x: 3.5, y: -5 }, { x: 10.5, y: -5 }, { x: -10.5, y: 5 }, { x: -3.5, y: 5 }, { x: 3.5, y: 5 }, { x: 10.5, y: 5 }],
  9: [{ x: -12, y: -5 }, { x: -6, y: -5 }, { x: 0, y: -5 }, { x: 6, y: -5 }, { x: 12, y: -5 }, { x: -9, y: 5 }, { x: -3, y: 5 }, { x: 3, y: 5 }, { x: 9, y: 5 }],
  10: [{ x: -12, y: -5 }, { x: -6, y: -5 }, { x: 0, y: -5 }, { x: 6, y: -5 }, { x: 12, y: -5 }, { x: -12, y: 5 }, { x: -6, y: 5 }, { x: 0, y: 5 }, { x: 6, y: 5 }, { x: 12, y: 5 }]
};

export function getTokenOffset(playerIndex: number, playerCount: number): TokenOffset {
  const safeCount = Math.min(10, Math.max(1, Math.trunc(playerCount)));
  const offsets = offsetsByPlayerCount[safeCount];
  return offsets[playerIndex] ?? offsets[playerIndex % offsets.length] ?? { x: 0, y: 0 };
}

export function getTokenRadius(playerCount: number): number {
  if (playerCount <= 2) return 6;
  if (playerCount <= 4) return 5;
  if (playerCount <= 6) return 4;
  if (playerCount <= 8) return 3.5;
  return 3;
}

export function getMoveDuration(playerCount: number): number {
  if (playerCount >= 8) return 72;
  if (playerCount >= 5) return 92;
  return 120;
}
