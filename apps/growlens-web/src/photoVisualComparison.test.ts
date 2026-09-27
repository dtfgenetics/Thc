import { describe, expect, it } from 'vitest';
import { hammingDistance, similarityPercent } from './photoVisualComparison';

describe('GrowLens photo visual comparison helpers', () => {
  it('computes hamming distance between equal-length hashes', () => {
    expect(hammingDistance('0000','0000')).toBe(0);
    expect(hammingDistance('0000','0101')).toBe(2);
    expect(hammingDistance('000','0000')).toBeNull();
  });

  it('converts hash distance into a stable similarity percentage', () => {
    expect(similarityPercent('0000','0000')).toBe(100);
    expect(similarityPercent('0000','0001')).toBe(75);
    expect(similarityPercent('000','0000')).toBeNull();
  });
});
