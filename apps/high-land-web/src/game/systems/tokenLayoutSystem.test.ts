import { describe, expect, it } from 'vitest';
import { getTokenOffset, getTokenRadius } from './tokenLayoutSystem';

describe('token layout system', () => {
  it('keeps colocated tokens within the center of a painted board space', () => {
    for (let playerCount = 1; playerCount <= 10; playerCount += 1) {
      for (let playerIndex = 0; playerIndex < playerCount; playerIndex += 1) {
        const offset = getTokenOffset(playerIndex, playerCount);
        const radius = getTokenRadius(playerCount);

        expect(Math.abs(offset.x) + radius).toBeLessThanOrEqual(17);
        expect(Math.abs(offset.y) + radius).toBeLessThanOrEqual(17);
      }
    }
  });

  it('keeps every pair of colocated player tokens visually distinct', () => {
    for (let playerCount = 2; playerCount <= 10; playerCount += 1) {
      const radius = getTokenRadius(playerCount);
      const offsets = Array.from({ length: playerCount }, (_, playerIndex) => getTokenOffset(playerIndex, playerCount));

      for (let left = 0; left < offsets.length; left += 1) {
        for (let right = left + 1; right < offsets.length; right += 1) {
          const dx = offsets[left].x - offsets[right].x;
          const dy = offsets[left].y - offsets[right].y;
          const centerDistance = Math.hypot(dx, dy);

          expect(centerDistance).toBeGreaterThanOrEqual(radius * 2);
        }
      }
    }
  });
});
