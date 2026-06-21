export type TokenOffset = {
  x: number;
  y: number;
};

const offsetsByPlayerCount: Record<number, TokenOffset[]> = {
  1: [{ x: 0, y: 0 }],
  2: [{ x: -6, y: 0 }, { x: 6, y: 0 }],
  3: [{ x: 0, y: -6 }, { x: -6, y: 5 }, { x: 6, y: 5 }],
  4: [{ x: -6, y: -6 }, { x: 6, y: -6 }, { x: -6, y: 6 }, { x: 6, y: 6 }]
};

export function getTokenOffset(playerIndex: number, playerCount: number): TokenOffset {
  const offsets = offsetsByPlayerCount[Math.min(Math.max(playerCount, 1), 4)] ?? offsetsByPlayerCount[1];
  return offsets[playerIndex % offsets.length] ?? { x: 0, y: 0 };
}

export function getTokenRadius(playerCount: number): number {
  if (playerCount <= 1) return 8;
  if (playerCount <= 2) return 7;
  return 6;
}

export function getMoveDuration(playerCount: number): number {
  return playerCount >= 4 ? 78 : 90;
}
