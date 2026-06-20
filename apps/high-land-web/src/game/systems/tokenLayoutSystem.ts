export type TokenOffset = {
  x: number;
  y: number;
};

export function getTokenOffset(playerIndex: number, playerCount: number): TokenOffset {
  if (playerCount <= 1) return { x: 0, y: 0 };

  const radius = playerCount <= 4 ? 16 : 28;
  const angle = (Math.PI * 2 * playerIndex) / playerCount - Math.PI / 2;

  return {
    x: Math.round(Math.cos(angle) * radius),
    y: Math.round(Math.sin(angle) * radius)
  };
}

export function getTokenRadius(playerCount: number): number {
  if (playerCount <= 4) return 12;
  if (playerCount <= 8) return 10;
  return 9;
}

export function getMoveDuration(playerCount: number): number {
  if (playerCount >= 8) return 72;
  if (playerCount >= 5) return 92;
  return 120;
}
