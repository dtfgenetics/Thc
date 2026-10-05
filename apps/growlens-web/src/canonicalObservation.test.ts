import { describe, expect, it, vi } from 'vitest';
import {
  CANONICAL_OBSERVATION_EVENT,
  createGrowLensObservationArtifacts,
  publishGrowLensCanonicalObservation,
} from './canonicalObservation';

describe('GrowLens canonical observation producer', () => {
  const observedAt = '2026-10-05T01:00:00.000Z';
  const state = {
    plants: [{
      id: 'plant-12345678',
      name: 'Blue Mango #1',
      strain: 'Blue Mango',
      stage: 'flowering' as const,
      status: 'active' as const,
      spaceId: 'space-12345678',
      cycleId: 'cycle-12345678',
      startDate: '2026-09-01',
      notes: '',
      createdAt: observedAt,
    }],
  };

  it('produces one normalized observation, diary entry, and cultivation record', () => {
    const result = createGrowLensObservationArtifacts({
      id: 'observation-12345678',
      plantId: 'plant-12345678',
      symptoms: ['leaf-curl', ' leaf-curl ', 'chlorosis'],
      notes: '  Progressed over two days.  ',
      candidateDifferentials: ['Heat stress', 'Root-zone stress'],
      severity: 'moderate',
      locationOnPlant: 'upper-canopy',
      tissue: 'leaf',
      photoIds: ['photo-12345678'],
      observedAt,
    }, state);

    expect(result.observation).toMatchObject({
      id: 'observation-12345678',
      symptoms: ['leaf-curl', 'chlorosis'],
      possibleCauses: ['Heat stress', 'Root-zone stress'],
      severity: 'moderate',
      locationOnPlant: 'upper-canopy',
      tissue: 'leaf',
      photoIds: ['photo-12345678'],
    });
    expect(result.diary).toMatchObject({
      plantId: 'plant-12345678',
      cycleId: 'cycle-12345678',
      type: 'photo',
    });
    expect(result.canonicalRecord).toMatchObject({
      schema: 'thc-cultivation-record',
      version: 1,
      type: 'plant-observation',
      sourceType: 'growlens',
      toolId: 'growlens',
      sourceId: 'observation-12345678',
      observationId: 'observation-12345678',
      plantId: 'plant-12345678',
      cycleId: 'cycle-12345678',
      spaceId: 'space-12345678',
      stage: 'flowering',
      cultivar: 'Blue Mango',
      provenance: {
        method: 'growlens-observation',
        estimated: false,
        derived: false,
      },
    });
    expect(result.canonicalRecord.values.candidateDifferentials).toEqual(['Heat stress', 'Root-zone stress']);
    expect(result.canonicalRecord.values).toMatchObject({ severity: 'moderate', locationOnPlant: 'upper-canopy', tissue: 'leaf' });
    expect(result.canonicalRecord.mediaRefs).toHaveLength(1);
  });

  it('does not convert candidate differentials into a confirmed diagnosis', () => {
    const result = createGrowLensObservationArtifacts({
      id: 'observation-87654321',
      plantId: null,
      symptoms: ['spots'],
      notes: '',
      candidateDifferentials: ['Possible pest pressure'],
      photoIds: [],
      observedAt,
    }, { plants: [] });

    expect(result.canonicalRecord.values).not.toHaveProperty('diagnosis');
    expect(result.canonicalRecord.provenance.estimated).toBe(false);
    expect(result.canonicalRecord.provenance.derived).toBe(false);
  });

  it('publishes the canonical record as a browser event for downstream consumers', () => {
    const dispatchEvent = vi.fn();
    class TestCustomEvent<T = unknown> {
      readonly type: string;
      readonly detail: T;

      constructor(type: string, init: { detail: T }) {
        this.type = type;
        this.detail = init.detail;
      }
    }

    vi.stubGlobal('window', { dispatchEvent });
    vi.stubGlobal('CustomEvent', TestCustomEvent);

    const { canonicalRecord } = createGrowLensObservationArtifacts({
      id: 'observation-abcdefgh',
      plantId: null,
      symptoms: [],
      notes: '',
      candidateDifferentials: [],
      photoIds: [],
      observedAt,
    }, { plants: [] });

    publishGrowLensCanonicalObservation(canonicalRecord);

    expect(dispatchEvent).toHaveBeenCalledTimes(1);
    const event = dispatchEvent.mock.calls[0]?.[0] as { type: string; detail: unknown };
    expect(event.type).toBe(CANONICAL_OBSERVATION_EVENT);
    expect(event.detail).toEqual(canonicalRecord);
    vi.unstubAllGlobals();
  });
});
