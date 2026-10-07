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
    readings: [
      { id: 'reading-before', spaceId: 'space-12345678', temperatureC: 26, humidity: 58, ppfd: 720, createdAt: '2026-10-05T00:45:00.000Z' },
      { id: 'reading-after', spaceId: 'space-12345678', temperatureC: 31, humidity: 40, ppfd: 900, createdAt: '2026-10-05T01:15:00.000Z' },
    ],
    irrigationRecords: [{
      id: 'irrigation-before',
      plantId: 'plant-12345678',
      cycleId: 'cycle-12345678',
      spaceId: 'space-12345678',
      sourceWater: 'RO',
      volumeAppliedMl: 900,
      runoffVolumeMl: 120,
      inputPh: 6.1,
      inputEcMsCm: 1.8,
      runoffPh: 6.3,
      runoffEcMsCm: 2.1,
      substrateMoisturePercent: 47,
      drybackPercent: 19,
      irrigationTimeMinutes: 4,
      reservoirId: 'reservoir-1',
      recipeNotes: '',
      productsUsed: [],
      createdAt: '2026-10-05T00:30:00.000Z',
      updatedAt: '2026-10-05T00:30:00.000Z',
    }],
    feedingRecords: [],
    diary: [{
      id: 'entry-training',
      plantId: 'plant-12345678',
      cycleId: 'cycle-12345678',
      type: 'training' as const,
      title: 'Canopy adjustment',
      notes: '',
      createdAt: '2026-10-04T22:00:00.000Z',
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
      photoIds: ['photo-12345678', 'photo-abcdefgh'],
      observedAt,
    }, state);

    expect(result.observation).toMatchObject({
      id: 'observation-12345678',
      symptoms: ['leaf-curl', 'chlorosis'],
      possibleCauses: ['Heat stress', 'Root-zone stress'],
      severity: 'moderate',
      locationOnPlant: 'upper-canopy',
      tissue: 'leaf',
      photoIds: ['photo-12345678', 'photo-abcdefgh'],
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
    expect(result.canonicalRecord.values).toMatchObject({
      severity: 'moderate',
      locationOnPlant: 'upper-canopy',
      tissue: 'leaf',
      environmentObservedAt: '2026-10-05T00:45:00.000Z',
      environmentAgeMinutes: 15,
      irrigationObservedAt: '2026-10-05T00:30:00.000Z',
      irrigationAgeMinutes: 30,
      contextRecordIds: ['reading-before', 'irrigation-before'],
    });
    expect(result.canonicalRecord.metrics).toMatchObject({
      temperatureC: 26,
      humidityPercent: 58,
      ppfdUmolM2S: 720,
      inputPh: 6.1,
      inputEcMsCm: 1.8,
      runoffPh: 6.3,
      runoffEcMsCm: 2.1,
      vwcPercent: 47,
      drybackPercent: 19,
      volumeMl: 900,
    });
    expect(result.canonicalRecord.units).toMatchObject({
      temperatureC: 'C',
      humidityPercent: '%',
      ppfdUmolM2S: 'umol/m2/s',
      inputPh: 'pH',
      inputEcMsCm: 'mS/cm',
    });
    expect(result.canonicalRecord.values.recentInterventions?.[0]).toContain('training');
    expect(result.canonicalRecord.values.recentInterventionAgesMinutes).toEqual([180]);
    expect(result.canonicalRecord.provenance.derived).toBe(false);
    expect(result.canonicalRecord.mediaRefs).toHaveLength(2);
    expect(result.canonicalRecord.mediaRefs.map((item) => item.ref)).toEqual(['photo-12345678', 'photo-abcdefgh']);
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


  it('preserves exact source time and age even when context is old instead of silently declaring it fresh', () => {
    const result = createGrowLensObservationArtifacts({
      id: 'observation-old-context',
      plantId: 'plant-12345678',
      symptoms: ['chlorosis'],
      notes: '',
      candidateDifferentials: [],
      photoIds: [],
      observedAt,
    }, {
      ...state,
      readings: [{
        id: 'reading-old',
        spaceId: 'space-12345678',
        temperatureC: 24,
        humidity: 62,
        ppfd: 500,
        createdAt: '2026-10-03T01:00:00.000Z',
      }],
      irrigationRecords: [],
      feedingRecords: [],
      diary: [],
    });

    expect(result.canonicalRecord.metrics.temperatureC).toBe(24);
    expect(result.canonicalRecord.values.environmentObservedAt).toBe('2026-10-03T01:00:00.000Z');
    expect(result.canonicalRecord.values.environmentAgeMinutes).toBe(2880);
    expect(result.canonicalRecord.provenance.derived).toBe(false);
  });

  it('never attaches cultivation context recorded after the observation timestamp', () => {
    const result = createGrowLensObservationArtifacts({
      id: 'observation-no-future',
      plantId: 'plant-12345678',
      symptoms: ['leaf-curl'],
      notes: '',
      candidateDifferentials: [],
      photoIds: [],
      observedAt,
    }, {
      ...state,
      readings: [{ id: 'future-only', spaceId: 'space-12345678', temperatureC: 35, humidity: 30, ppfd: 1000, createdAt: '2026-10-05T02:00:00.000Z' }],
      irrigationRecords: [],
      diary: [],
    });

    expect(result.canonicalRecord.metrics).toEqual({});
    expect(result.canonicalRecord.values).not.toHaveProperty('environmentObservedAt');
    expect(result.canonicalRecord.values).not.toHaveProperty('contextRecordIds');
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
