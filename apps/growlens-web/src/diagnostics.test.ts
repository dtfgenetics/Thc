import { describe, expect, it } from 'vitest';
import { diagnoseSymptoms } from './diagnostics';

describe('GrowLens diagnostic engine', () => {
  it('ranks pest pressure highly when direct pest evidence is selected', () => {
    const results = diagnoseSymptoms(['webbing', 'stippling', 'visible-insects']);
    expect(results[0]?.cause).toBe('Possible pest pressure');
    expect(results[0]?.confidence).toBe('high');
    expect(results[0]?.evidenceQuality).toBe('direct');
  });

  it('does not return unrelated causes without supporting evidence', () => {
    const results = diagnoseSymptoms(['drooping-dry-medium']);
    expect(results[0]?.cause).toBe('Possible underwatering');
    expect(results.some((result) => result.cause.includes('pest'))).toBe(false);
  });

  it('uses location and tissue as contextual evidence without inventing a diagnosis', () => {
    const results = diagnoseSymptoms(['new-growth-twisted', 'rust-spots'], {
      locationOnPlant: 'new-growth',
      tissue: 'leaf',
    });
    expect(results[0]?.cause).toBe('Possible calcium deficiency or transport issue');
    expect(results[0]?.contextualEvidence).toEqual(expect.arrayContaining([
      'location:new-growth',
      'tissue:leaf',
    ]));
    expect(results[0]?.evidenceQuality).toBe('contextual');
  });

  it('does not label symptom-pattern-only nutrient matches as high confidence', () => {
    const results = diagnoseSymptoms(['interveinal-yellowing', 'older-leaves-yellow', 'rust-spots']);
    const magnesium = results.find((result) => result.cause.includes('magnesium'));
    expect(magnesium?.score).toBeGreaterThanOrEqual(6);
    expect(magnesium?.confidence).toBe('medium');
    expect(magnesium?.evidenceQuality).toBe('pattern');
  });

  it('does not create candidates from context alone', () => {
    expect(diagnoseSymptoms([], { locationOnPlant: 'upper-canopy', tissue: 'leaf' })).toEqual([]);
  });

  it('returns no diagnosis when no symptoms are supplied', () => {
    expect(diagnoseSymptoms([])).toEqual([]);
  });
});
