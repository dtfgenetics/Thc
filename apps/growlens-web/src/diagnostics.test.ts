import { describe, expect, it } from 'vitest';
import { diagnoseSymptoms } from './diagnostics';

describe('GrowLens diagnostic engine', () => {
  it('ranks pest pressure highly when direct pest evidence is selected', () => {
    const results = diagnoseSymptoms(['webbing', 'stippling', 'visible-insects']);
    expect(results[0]?.cause).toBe('Possible pest pressure');
    expect(results[0]?.confidence).toBe('high');
  });

  it('does not return unrelated causes without supporting evidence', () => {
    const results = diagnoseSymptoms(['drooping-dry-medium']);
    expect(results[0]?.cause).toBe('Possible underwatering');
    expect(results.some((result) => result.cause.includes('pest'))).toBe(false);
  });

  it('returns no diagnosis when no symptoms are supplied', () => {
    expect(diagnoseSymptoms([])).toEqual([]);
  });
});
