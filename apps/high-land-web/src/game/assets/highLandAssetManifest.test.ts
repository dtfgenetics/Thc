import { describe, expect, it } from 'vitest';
import { starterActionCards } from '../data/actionCards';
import {
  getDeploymentCriticalHighLandAssets,
  getPlaceholderAllowedAssets,
  getRequiredHighLandAssets
} from './highLandAssetManifest';

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

  it('separates deployment-critical assets from allowed emergency fallbacks', () => {
    const criticalAssets = getDeploymentCriticalHighLandAssets();
    const fallbackAssets = getPlaceholderAllowedAssets();

    expect(criticalAssets.length).toBeGreaterThan(0);
    expect(criticalAssets.every((asset) => asset.required)).toBe(true);
    expect(criticalAssets.every((asset) => !asset.placeholderAllowed)).toBe(true);
    expect(criticalAssets.map((asset) => asset.id)).not.toContain('hit-card-fallback');
    expect(fallbackAssets.map((asset) => asset.id)).toContain('hit-card-fallback');
  });
});
