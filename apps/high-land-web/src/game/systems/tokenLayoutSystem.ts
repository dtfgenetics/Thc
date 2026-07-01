export type TokenOffset = {
  x: number;
  y: number;
};

const offsetsByPlayerCount: Record<number, TokenOffset[]> = {
  1: [{ x: 0, y: 0 }],
  2: [{ x: -8, y: 0 }, { x: 8, y: 0 }],
  3: [{ x: 0, y: -7 }, { x: -8, y: 6 }, { x: 8, y: 6 }],
  4: [{ x: -7, y: -6 }, { x: 7, y: -6 }, { x: -7, y: 6 }, { x: 7, y: 6 }],
  5: [{ x: -9, y: -6 }, { x: 0, y: -6 }, { x: 9, y: -6 }, { x: -5, y: 6 }, { x: 5, y: 6 }],
  6: [{ x: -9, y: -6 }, { x: 0, y: -6 }, { x: 9, y: -6 }, { x: -9, y: 6 }, { x: 0, y: 6 }, { x: 9, y: 6 }],
  7: [{ x: -12, y: -6 }, { x: -6, y: -6 }, { x: 0, y: -6 }, { x: 6, y: -6 }, { x: 12, y: -6 }, { x: -4, y: 6 }, { x: 4, y: 6 }],
  8: [{ x: -12, y: -6 }, { x: -4, y: -6 }, { x: 4, y: -6 }, { x: 12, y: -6 }, { x: -12, y: 6 }, { x: -4, y: 6 }, { x: 4, y: 6 }, { x: 12, y: 6 }],
  9: [{ x: -12, y: -6 }, { x: -6, y: -6 }, { x: 0, y: -6 }, { x: 6, y: -6 }, { x: 12, y: -6 }, { x: -9, y: 6 }, { x: -3, y: 6 }, { x: 3, y: 6 }, { x: 9, y: 6 }],
  10: [{ x: -12, y: -6 }, { x: -6, y: -6 }, { x: 0, y: -6 }, { x: 6, y: -6 }, { x: 12, y: -6 }, { x: -12, y: 6 }, { x: -6, y: 6 }, { x: 0, y: 6 }, { x: 6, y: 6 }, { x: 12, y: 6 }]
};

export function getTokenOffset(playerIndex: number, playerCount: number): TokenOffset {
  const safeCount = Math.min(10, Math.max(1, Math.trunc(playerCount)));
  const offsets = offsetsByPlayerCount[safeCount];
  return offsets[playerIndex] ?? offsets[playerIndex % offsets.length] ?? { x: 0, y: 0 };
}

export function getTokenRadius(playerCount: number): number {
  if (playerCount <= 2) return 8;
  if (playerCount <= 4) return 7;
  if (playerCount <= 6) return 6;
  return 5;
}

export function getMoveDuration(playerCount: number): number {
  if (playerCount >= 8) return 72;
  if (playerCount >= 5) return 92;
  return 120;
}
