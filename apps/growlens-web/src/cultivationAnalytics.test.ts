import { describe, expect, it } from 'vitest';
import { buildCultivationAnalytics, createPlantAnalyticsCsv, metricSummary } from './cultivationAnalytics';
import { emptyState } from './storage';

const timestamp = '2026-07-13T12:00:00.000Z';
const state = {
  ...structuredClone(emptyState),
  spaces: [
    { id: 'space-one-12345678', name: 'Flower Tent A', environment: 'indoor' as const, lightHours: 12, createdAt: timestamp },
    { id: 'space-two-12345678', name: 'Flower Tent B', environment: 'indoor' as const, lightHours: 12, createdAt: timestamp },
  ],
  cycles: [
    { id: 'cycle-one-12345678', name: 'Blue Mango Run', spaceId: 'space-one-12345678', startDate: '2026-06-01', stage: 'flowering' as const, status: 'active' as const },
    { id: 'cycle-two-12345678', name: 'Cali Orange Run', spaceId: 'space-two-12345678', startDate: '2026-06-15', stage: 'flowering' as const, status: 'active' as const },
  ],
  plants: [
    { id: 'plant-one-12345678', name: 'BM-01', strain: 'Blue Mango F3', stage: 'complete' as const, status: 'harvested' as const, spaceId: 'space-one-12345678', cycleId: 'cycle-one-12345678', startDate: '2026-06-01', notes: '', createdAt: timestamp },
    { id: 'plant-two-12345678', name: 'BM-02', strain: 'Blue Mango F3', stage: 'flowering' as const, status: 'active' as const, spaceId: 'space-one-12345678', cycleId: 'cycle-one-12345678', startDate: '2026-06-01', notes: '', createdAt: timestamp },
    { id: 'plant-three-12345678', name: 'CO-01', strain: 'Cali Orange F2', stage: 'flowering' as const, status: 'active' as const, spaceId: 'space-two-12345678', cycleId: 'cycle-two-12345678', startDate: '2026-06-15', notes: '', createdAt: timestamp },
  ],
  irrigationRecords: [
    { id: 'irrigation-one-12345678', plantId: 'plant-one-12345678', cycleId: 'cycle-one-12345678', spaceId: 'space-one-12345678', sourceWater: 'RO', volumeAppliedMl: 1500, runoffVolumeMl: 225, inputPh: 6.2, inputEcMsCm: 1.8, runoffPh: 6.4, runoffEcMsCm: 2.1, substrateMoisturePercent: null, drybackPercent: null, irrigationTimeMinutes: null, reservoirId: null, recipeNotes: '', productsUsed: [], createdAt: timestamp, updatedAt: timestamp },
    { id: 'irrigation-two-12345678', plantId: 'plant-one-12345678', cycleId: 'cycle-one-12345678', spaceId: 'space-one-12345678', sourceWater: 'RO', volumeAppliedMl: 1500, runoffVolumeMl: 300, inputPh: 6.1, inputEcMsCm: 1.9, runoffPh: 6.3, runoffEcMsCm: 2.0, substrateMoisturePercent: null, drybackPercent: null, irrigationTimeMinutes: null, reservoirId: null, recipeNotes: '', productsUsed: [], createdAt: timestamp, updatedAt: timestamp },
    { id: 'irrigation-three-12345678', plantId: 'plant-two-12345678', cycleId: 'cycle-one-12345678', spaceId: 'space-one-12345678', sourceWater: 'RO', volumeAppliedMl: 1000, runoffVolumeMl: null, inputPh: 6.2, inputEcMsCm: 1.7, runoffPh: null, runoffEcMsCm: null, substrateMoisturePercent: null, drybackPercent: null, irrigationTimeMinutes: null, reservoirId: null, recipeNotes: '', productsUsed: [], createdAt: timestamp, updatedAt: timestamp },
  ],
  feedingRecords: [
    { id: 'feeding-one-12345678', plantId: 'plant-one-12345678', cycleId: 'cycle-one-12345678', reservoirId: null, waterVolumeMl: 3000, sourceWater: 'RO', startingEcMsCm: 0.2, finalEcMsCm: 1.9, finalPh: 6.1, ppm: 950, ppmScale: 500 as const, products: [], additives: [], mixingNotes: '', createdAt: timestamp, updatedAt: timestamp },
  ],
  harvestRecords: [
    { id: 'harvest-one-12345678', plantId: 'plant-one-12345678', cycleId: 'cycle-one-12345678', lotId: 'LOT-01', harvestDate: '2026-07-10', wetWeightG: 1000, dryWeightG: 240, trimmedWeightG: 210, wasteWeightG: 30, dryingTemperatureC: 18, dryingHumidity: 60, dryingDays: 10, cureStartedAt: timestamp, cureCheckpoints: [], finalPhotoIds: [], notes: '', createdAt: timestamp, updatedAt: timestamp },
  ],
  observations: [
    { id: 'observation-one-12345678', plantId: 'plant-one-12345678', symptoms: ['webbing'], notes: '', possibleCauses: ['Possible pest pressure'], photoIds: [], createdAt: timestamp },
    { id: 'observation-two-12345678', plantId: 'plant-two-12345678', symptoms: ['spots'], notes: '', possibleCauses: ['Possible stress'], photoIds: [], createdAt: timestamp },
  ],
  observationOutcomes: [
    { id: 'outcome-one-12345678', observationId: 'observation-one-12345678', plantId: 'plant-one-12345678', status: 'resolved' as const, verifiedCause: 'Spider mites', actionTaken: '', outcomeNotes: '', resolvedAt: timestamp, createdAt: timestamp, updatedAt: timestamp },
    { id: 'outcome-two-12345678', observationId: 'observation-two-12345678', plantId: 'plant-two-12345678', status: 'monitoring' as const, verifiedCause: '', actionTaken: '', outcomeNotes: '', resolvedAt: null, createdAt: timestamp, updatedAt: timestamp },
  ],
};

describe('cultivation analytics', () => {
  it('summarizes numeric values without inventing missing measurements', () => {
    expect(metricSummary([1, 2, null, undefined, 3])).toEqual({ count: 3, average: 2, minimum: 1, maximum: 3 });
    expect(metricSummary([null, undefined])).toEqual({ count: 0, average: null, minimum: null, maximum: null });
  });

  it('calculates plant irrigation, harvest, and outcome metrics', () => {
    const analytics = buildCultivationAnalytics(state, new Date('2026-07-13T12:00:00.000Z'));
    const plant = analytics.plants.find((candidate) => candidate.plantId === 'plant-one-12345678');
    expect(plant).toMatchObject({
      irrigationEvents: 2,
      appliedLiters: 3,
      runoffLiters: 0.53,
      averageRunoffPercent: 17.5,
      feedingEvents: 1,
      latestFeedPh: 6.1,
      latestFeedEcMsCm: 1.9,
      harvestEvents: 1,
      wetWeightG: 1000,
      dryWeightG: 240,
      trimmedWeightG: 210,
      wasteWeightG: 30,
      wetToDryLossPercent: 76,
      observations: 1,
      outcomes: 1,
      resolvedOutcomes: 1,
    });
    expect(plant?.ageDays).toBe(39);
    expect(plant?.yieldPerDayG).toBeCloseTo(5.38, 2);
  });

  it('aggregates cultivar, cycle, and space metrics', () => {
    const analytics = buildCultivationAnalytics(state, new Date('2026-07-13T12:00:00.000Z'));
    const cultivar = analytics.cultivars.find((candidate) => candidate.id === 'Blue Mango F3');
    expect(cultivar).toMatchObject({
      plants: 2,
      activePlants: 1,
      harvestedPlants: 1,
      irrigationEvents: 3,
      appliedLiters: 4,
      feedingEvents: 1,
      harvestEvents: 1,
      totalTrimmedWeightG: 210,
      averageTrimmedWeightPerHarvestG: 210,
      observationResolutionPercent: 50,
    });
    expect(analytics.cycles[0]?.label).toBe('Blue Mango Run');
    expect(analytics.spaces[0]?.label).toBe('Flower Tent A');
  });

  it('builds an overall summary with measured totals', () => {
    const analytics = buildCultivationAnalytics(state, new Date('2026-07-13T12:00:00.000Z'));
    expect(analytics.overall).toMatchObject({
      activePlants: 2,
      harvestedPlants: 1,
      totalAppliedLiters: 4,
      totalRunoffLiters: 0.53,
      averageRunoffPercent: 17.5,
      feedingEvents: 1,
      harvestEvents: 1,
      totalWetWeightG: 1000,
      totalDryWeightG: 240,
      totalTrimmedWeightG: 210,
      totalWasteWeightG: 30,
      observationCount: 2,
      resolvedObservationCount: 1,
      observationResolutionPercent: 50,
    });
  });

  it('exports plant analytics as CSV with explicit fields', () => {
    const analytics = buildCultivationAnalytics(state, new Date('2026-07-13T12:00:00.000Z'));
    const csv = createPlantAnalyticsCsv(analytics);
    expect(csv).toContain('averageRunoffPercent');
    expect(csv).toContain('yieldPerDayG');
    expect(csv).toContain('BM-01');
    expect(csv).toContain('Blue Mango F3');
  });
});
