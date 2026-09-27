import { describe, expect, it } from 'vitest';
import { distribution, linearTrendByTime, pearsonCorrelation, quantile } from './statisticalInsights';

describe('GrowLens statistical insights', () => {
  it('computes interpolated quantiles and distributions', () => {
    expect(quantile([1,2,3,4,5], .5)).toBe(3);
    expect(quantile([1,2,3,4], .25)).toBe(1.75);
    const summary = distribution([1,2,3,4,5]);
    expect(summary).not.toBeNull();
    expect(summary?.minimum).toBe(1);
    expect(summary?.median).toBe(3);
    expect(summary?.maximum).toBe(5);
    expect(summary?.average).toBe(3);
  });

  it('requires a minimum sample before reporting a correlation', () => {
    const small = pearsonCorrelation([[1,2],[2,4],[3,6]]);
    expect(small.r).toBeNull();
    expect(small.strength).toBe('insufficient-data');
  });

  it('detects positive and negative linear relationships', () => {
    const positive = pearsonCorrelation([[1,2],[2,4],[3,6],[4,8],[5,10]]);
    expect(positive.r).toBeCloseTo(1, 3);
    expect(positive.direction).toBe('positive');
    const negative = pearsonCorrelation([[1,10],[2,8],[3,6],[4,4],[5,2]]);
    expect(negative.r).toBeCloseTo(-1, 3);
    expect(negative.direction).toBe('negative');
  });

  it('does not report a coefficient when either variable has no variance', () => {
    const result = pearsonCorrelation([[1,2],[1,3],[1,4],[1,5],[1,6]]);
    expect(result.r).toBeNull();
    expect(result.strength).toBe('insufficient-data');
  });

  it('computes a simple slope per day from timestamps', () => {
    const trend = linearTrendByTime([
      { timestamp:'2026-09-01T00:00:00.000Z', value:20 },
      { timestamp:'2026-09-02T00:00:00.000Z', value:21 },
      { timestamp:'2026-09-03T00:00:00.000Z', value:22 },
    ]);
    expect(trend.slopePerDay).toBeCloseTo(1, 4);
  });
});
