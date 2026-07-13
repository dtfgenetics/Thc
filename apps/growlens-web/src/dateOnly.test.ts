import { describe, expect, it } from 'vitest';
import { isValidDateInput, localDateInput } from './dateOnly';

describe('GrowLens local calendar dates', () => {
  it('formats a local date without converting through UTC', () => {
    const localLateEvening = new Date(2026, 6, 13, 23, 45, 0);
    expect(localDateInput(localLateEvening)).toBe('2026-07-13');
  });

  it('pads single-digit months and days', () => {
    expect(localDateInput(new Date(2026, 0, 4, 12, 0, 0))).toBe('2026-01-04');
  });

  it('rejects impossible or malformed date inputs', () => {
    expect(isValidDateInput('2026-02-29')).toBe(false);
    expect(isValidDateInput('2028-02-29')).toBe(true);
    expect(isValidDateInput('07/13/2026')).toBe(false);
  });
});
