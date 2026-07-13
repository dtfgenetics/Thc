import { describe, expect, it } from 'vitest';
import {
  calculateDliMol,
  calculateVpdKpa,
  canopyUniformityPercent,
  luxToPpfd,
  ppfdToLux,
} from './calculations';

describe('GrowLens calculations', () => {
  it('calculates DLI from PPFD and photoperiod', () => {
    expect(calculateDliMol(500, 18)).toBeCloseTo(32.4, 2);
  });

  it('calculates a plausible VPD value', () => {
    expect(calculateVpdKpa(26, 60, -1)).toBeCloseTo(1.16, 1);
  });

  it('converts lux and PPFD with a calibration factor', () => {
    expect(luxToPpfd(40_000, 0.015)).toBeCloseTo(600, 2);
    expect(ppfdToLux(600, 0.015)).toBeCloseTo(40_000, 2);
  });

  it('calculates canopy uniformity as minimum divided by average', () => {
    expect(canopyUniformityPercent([400, 500, 600])).toBeCloseTo(80, 2);
  });
});
