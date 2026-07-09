import Phaser from 'phaser';
import { describe, expect, it } from 'vitest';
import { getHighLandRendererType } from './HighLandGame';

function matchMediaWith(matches: boolean): typeof window.matchMedia {
  return (() => ({ matches })) as unknown as typeof window.matchMedia;
}

describe('High Land game renderer selection', () => {
  it('uses Canvas on narrow mobile viewports to avoid the live black-board WebGL issue', () => {
    expect(getHighLandRendererType(matchMediaWith(true))).toBe(Phaser.CANVAS);
  });

  it('keeps Phaser AUTO on wider desktop/tablet viewports', () => {
    expect(getHighLandRendererType(matchMediaWith(false))).toBe(Phaser.AUTO);
  });
});
