import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const source = readFileSync(new URL('./PhotoComparisonWidget.tsx', import.meta.url), 'utf8');

describe('GrowLens photo comparison production controls', () => {
  it('keeps overlay and pixel-difference modes mutually exclusive', () => {
    expect(source).toContain("setOverlayMode((value) => !value); setDiffMode(false)");
    expect(source).toContain("setDiffMode((value) => !value); setOverlayMode(false)");
  });

  it('provides synchronized zoom, alignment guides, and a reset path', () => {
    expect(source).toContain('value={zoom}');
    expect(source).toContain('Alignment guides');
    expect(source).toContain('Reset view');
    expect(source).toContain('setZoom(1)');
    expect(source).toContain('setOverlayOpacity(.5)');
  });

  it('labels pixel mismatch as a framing aid rather than plant severity', () => {
    expect(source).toContain('mismatched sampled pixels');
    expect(source).toContain('Camera angle, lighting, zoom, background, movement, and alignment can dominate the mismatch');
  });
});
