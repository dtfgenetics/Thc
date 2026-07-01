import { describe, expect, it } from 'vitest';
import { getTokenOffset, getTokenRadius } from './tokenLayoutSystem';

describe('token layout system', () => {
  it('keeps colocated tokens within the center of a painted board space', () => {
    for (let playerCount = 1; playerCount <= 10; playerCount += 1) {
      for (let playerIndex = 0; playerIndex < playerCount; playerIndex += 1) {
        const offset = getTokenOffset(playerIndex, playerCount);
        const radius = getTokenRadius(playerCount);

        expect(Math.abs(offset.x) + radius).toBeLessThanOrEqual(18);
        expect(Math.abs(offset.y) + radius).toBeLessThanOrEqual(18);
      }
    }
  });
});
