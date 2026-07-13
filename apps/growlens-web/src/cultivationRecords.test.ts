import { describe, expect, it } from 'vitest';
import {
  harvestDryLossPercent,
  irrigationRunoffPercent,
  normalizeFeedingRecords,
  normalizeHarvestRecords,
  normalizeIrrigationRecords,
  normalizeObservationOutcomes,
  normalizeReservoirRecords,
  validateHarvestInput,
  validateIrrigationInput,
} from './cultivationRecords';
import { normalizeState } from './storage';
import { mergeGrowLensStates } from './syncMerge';

const timestamp = '2026-07-13T12:00:00.000Z';

describe('structured cultivation records', () => {
  it('migrates schema-v1 state without losing existing records', () => {
    const state = normalizeState({
      schemaVersion: 1,
      plants: [{ id: 'plant-existing', name: 'BM-01' }],
      diary: [{ id: 'entry-existing', title: 'Existing note' }],
    });

    expect(state.schemaVersion).toBe(2);
    expect(state.plants).toHaveLength(1);
    expect(state.diary).toHaveLength(1);
    expect(state.irrigationRecords).toEqual([]);
    expect(state.harvestRecords).toEqual([]);
  });

  it('normalizes valid irrigation, feeding, reservoir, harvest, and outcome records', () => {
    expect(normalizeIrrigationRecords([{
      id: 'irrigation-12345678',
      plantId: 'plant-12345678',
      cycleId: 'cycle-12345678',
      sourceWater: 'Filtered tap',
      volumeAppliedMl: 1500,
      runoffVolumeMl: 225,
      inputPh: 6.2,
      inputEcMsCm: 1.8,
      runoffPh: 6.4,
      runoffEcMsCm: 2.1,
      productsUsed: ['Base A', 'Base B'],
      createdAt: timestamp,
      updatedAt: timestamp,
    }])).toHaveLength(1);

    expect(normalizeFeedingRecords([{
      id: 'feeding-12345678',
      waterVolumeMl: 4000,
      finalEcMsCm: 1.9,
      finalPh: 6.1,
      ppm: 950,
      ppmScale: 500,
      products: [{ name: 'Bloom', amount: 8, unit: 'mL' }],
      createdAt: timestamp,
      updatedAt: timestamp,
    }])[0]?.products[0]).toEqual({ name: 'Bloom', amount: 8, unit: 'mL' });

    expect(normalizeReservoirRecords([{
      id: 'reservoir-12345678',
      name: 'Tent A reservoir',
      capacityLiters: 40,
      currentVolumeLiters: 30,
      ph: 6.0,
      ecMsCm: 1.7,
      createdAt: timestamp,
      updatedAt: timestamp,
    }])).toHaveLength(1);

    expect(normalizeHarvestRecords([{
      id: 'harvest-12345678',
      plantId: 'plant-12345678',
      harvestDate: '2026-07-13',
      wetWeightG: 1000,
      dryWeightG: 240,
      finalPhotoIds: ['photo-12345678'],
      createdAt: timestamp,
      updatedAt: timestamp,
    }])).toHaveLength(1);

    expect(normalizeObservationOutcomes([{
      id: 'outcome-12345678',
      observationId: 'observation-12345678',
      status: 'resolved',
      verifiedCause: 'Spider mites verified with magnification',
      resolvedAt: timestamp,
      createdAt: timestamp,
      updatedAt: timestamp,
    }])).toHaveLength(1);
  });

  it('drops invalid records instead of persisting impossible measurements', () => {
    expect(normalizeIrrigationRecords([{ id: 'bad', volumeAppliedMl: -10 }])).toEqual([]);
    expect(normalizeReservoirRecords([{ id: 'reservoir-12345678', name: '' }])).toEqual([]);
    expect(normalizeHarvestRecords([{ id: 'harvest-12345678', plantId: '', harvestDate: 'not-a-date' }])).toEqual([]);
    expect(normalizeObservationOutcomes([{ id: 'outcome-12345678', observationId: 'observation-12345678', status: 'guessed' }])).toEqual([]);
  });

  it('calculates runoff and wet-to-dry loss honestly', () => {
    expect(irrigationRunoffPercent({ volumeAppliedMl: 1500, runoffVolumeMl: 225 } as never)).toBe(15);
    expect(harvestDryLossPercent({ wetWeightG: 1000, dryWeightG: 240 } as never)).toBe(76);
    expect(irrigationRunoffPercent({ volumeAppliedMl: 1500, runoffVolumeMl: null } as never)).toBeNull();
  });

  it('reports user-facing range errors', () => {
    expect(validateIrrigationInput({
      volumeAppliedMl: 0,
      runoffVolumeMl: -1,
      inputPh: 15,
      inputEcMsCm: 21,
      runoffPh: null,
      runoffEcMsCm: null,
    })).toEqual(expect.arrayContaining([
      'Volume applied must be greater than zero.',
      'Runoff volume cannot be negative.',
      'Input pH must be between 0 and 14.',
      'Input EC must be between 0 and 20 mS/cm.',
    ]));

    expect(validateHarvestInput({
      plantId: '',
      harvestDate: '',
      wetWeightG: -1,
      dryWeightG: null,
      trimmedWeightG: null,
      wasteWeightG: null,
    })).toEqual(expect.arrayContaining(['Choose a plant.', 'Harvest date is required.', 'Wet weight cannot be negative.']));
  });

  it('merges structured records by ID with the current device winning conflicts', () => {
    const remote = normalizeState({
      irrigationRecords: [{
        id: 'irrigation-12345678',
        volumeAppliedMl: 1000,
        sourceWater: 'Remote',
        createdAt: timestamp,
        updatedAt: timestamp,
      }],
    });
    const local = normalizeState({
      irrigationRecords: [{
        id: 'irrigation-12345678',
        volumeAppliedMl: 1200,
        sourceWater: 'Local',
        createdAt: timestamp,
        updatedAt: timestamp,
      }],
      harvestRecords: [{
        id: 'harvest-12345678',
        plantId: 'plant-12345678',
        harvestDate: '2026-07-13',
        createdAt: timestamp,
        updatedAt: timestamp,
      }],
    });

    const merged = mergeGrowLensStates(local, remote);
    expect(merged.irrigationRecords[0]?.sourceWater).toBe('Local');
    expect(merged.harvestRecords).toHaveLength(1);
  });
});
