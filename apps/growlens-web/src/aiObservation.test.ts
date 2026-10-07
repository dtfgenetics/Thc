import { describe, expect, it } from 'vitest';
import { normalizeVisualObservation, visualObservationToSymptomCandidates } from './aiObservation';

describe('GrowLens machine visual observation boundary', () => {
  it('normalizes visible evidence without creating diagnostic claims', () => {
    const observation = normalizeVisualObservation({
      providerId: 'moondream',
      modelId: 'moondream-local',
      mediaRef: 'photo-123',
      observedAt: '2026-10-06T20:00:00.000Z',
      summary: 'Lower foliage shows pale interveinal tissue.',
      visibleFindings: ['interveinal chlorosis', ' lower-leaf paling '],
      regions: [{
        label: 'chlorotic-region',
        confidence: 1.4,
        box: { x: -0.2, y: 0.1, width: 0.5, height: 0.3 },
      }],
      limitations: ['Single image; underside not visible.'],
    });

    expect(observation.schema).toBe('growlens-visual-observation');
    expect(observation.diagnosticClaims).toEqual([]);
    expect(observation.reviewState).toBe('machine-observation');
    expect(observation.evidence.regions[0].confidence).toBe(1);
    expect(observation.evidence.regions[0].box?.x).toBe(0);
    expect(visualObservationToSymptomCandidates(observation)).toEqual([
      'interveinal chlorosis',
      'lower-leaf paling',
      'chlorotic-region',
    ]);
  });

  it('requires explicit provider, model, and media provenance', () => {
    expect(() => normalizeVisualObservation({
      providerId: '',
      modelId: 'model',
      mediaRef: 'photo',
      observedAt: '2026-10-06T20:00:00.000Z',
      summary: '',
      visibleFindings: [],
      regions: [],
      limitations: [],
    })).toThrow(/providerId/);
  });
});
