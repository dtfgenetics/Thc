import { describe, expect, it } from 'vitest';
import { starterActionCards } from '../data/actionCards';
import { getRequiredHighLandAssets } from './highLandAssetManifest';

describe('High Land asset manifest', () => {
  it('requires the approved artwork source used by every HIT card', () => {
    const requiredPaths = new Set(getRequiredHighLandAssets().map((asset) => asset.path));

    starterActionCards.forEach((card) => {
      const preferredArt = card.imageSrc ?? card.sheetArt?.src;
      expect(preferredArt).toBeTruthy();
      expect(requiredPaths.has(preferredArt ?? '')).toBe(true);
    });
  });

  it('does not require the removed placeholder card-back path', () => {
    const requiredPaths = getRequiredHighLandAssets().map((asset) => asset.path);
    expect(requiredPaths).not.toContain('assets/high-land/cards/hit-card-back.png');
  });
});
