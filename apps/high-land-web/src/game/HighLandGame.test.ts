import { describe, expect, it } from 'vitest';
import { shouldUseHighLandCanvasRenderer } from './rendererSelection';

function matchMediaWith(matches: boolean) {
  return () => ({ matches });
}

describe('High Land game renderer selection', () => {
  it('uses Canvas on narrow mobile viewports to avoid the live black-board WebGL issue', () => {
    expect(shouldUseHighLandCanvasRenderer(matchMediaWith(true))).toBe(true);
  });

  it('keeps Phaser AUTO on wider desktop/tablet viewports', () => {
    expect(shouldUseHighLandCanvasRenderer(matchMediaWith(false))).toBe(false);
  });
});
