import { describe, expect, it } from 'vitest';
import { normalizeMoondreamObservation } from './moondreamObservation';

describe('normalizeMoondreamObservation', () => {
  it('keeps grounded visual fields without adding diagnostic claims', () => {
    const result = normalizeMoondreamObservation({
      summary: 'Lower leaves show pale interveinal areas and scattered brown spots.',
      fields: {
        tissue_and_distribution: 'Lower leaves',
        visible_color_changes: 'Pale areas between veins',
      },
      requestId: 'req-123',
      analyzedAt: '2026-10-06T23:00:00.000Z',
    });

    expect(result.provider).toBe('moondream');
    expect(result.mode).toBe('visual-observation');
    expect(result.fields.visible_color_changes).toContain('Pale');
    expect(result.requestId).toBe('req-123');
  });

  it('rejects an empty provider response', () => {
    expect(() => normalizeMoondreamObservation({ summary: '   ' })).toThrow(/empty observation/i);
  });
});
