import { harvestDryLossPercent, irrigationRunoffPercent } from './cultivationRecords';
import { normalizeState } from './storage';
import type { GrowLensState } from './types';

export type MetricSummary = {
  count: number;
  average: number | null;
  minimum: number | null;
  maximum: number | null;
};

export type OverallCultivationAnalytics = {
  activePlants: number;
  harvestedPlants: number;
  totalAppliedLiters: number;
  totalRunoffLiters: number;
  averageRunoffPercent: number | null;
  feedingEvents: number;
  harvestEvents: number;
  totalWetWeightG: number;
  totalDryWeightG: number;
  totalTrimmedWeightG: number;
  totalWasteWeightG: number;
  observationCount: number;
  resolvedObservationCount: number;
  observationResolutionPercent: number | null;
};

export type PlantCultivationAnalytics = {
  plantId: string;
  name: string;
  cultivar: string;
  status: string;
  stage: string;
  cycleId: string;
  cycleName: string;
  spaceId: string;
  spaceName: string;
  ageDays: number | null;
  irrigationEvents: number;
  appliedLiters: number;
  runoffLiters: number;
  averageRunoffPercent: number | null;
  inputPh: MetricSummary;
  inputEcMsCm: MetricSummary;
  runoffPh: MetricSummary;
  runoffEcMsCm: MetricSummary;
  feedingEvents: number;
  latestFeedPh: number | null;
  latestFeedEcMsCm: number | null;
  harvestEvents: number;
  wetWeightG: number;
  dryWeightG: number;
  trimmedWeightG: number;
  wasteWeightG: number;
  wetToDryLossPercent: number | null;
  yieldPerDayG: number | null;
  observations: number;
  outcomes: number;
  resolvedOutcomes: number;
};

export type GroupCultivationAnalytics = {
  id: string;
  label: string;
  plants: number;
  activePlants: number;
  harvestedPlants: number;
  irrigationEvents: number;
  appliedLiters: number;
  feedingEvents: number;
  harvestEvents: number;
  totalTrimmedWeightG: number;
  averageTrimmedWeightPerHarvestG: number | null;
  averageRunoffPercent: number | null;
  observationResolutionPercent: number | null;
};

export type CultivationAnalytics = {
  overall: OverallCultivationAnalytics;
  plants: PlantCultivationAnalytics[];
  cultivars: GroupCultivationAnalytics[];
  cycles: GroupCultivationAnalytics[];
  spaces: GroupCultivationAnalytics[];
};

function round(value: number, decimals = 2): number {
  const factor = 10 ** decimals;
  return Math.round(value * factor) / factor;
}

function sum(values: number[]): number {
  return values.reduce((total, value) => total + value, 0);
}

function nullableValues(values: Array<number | null | undefined>): number[] {
  return values.filter((value): value is number => typeof value === 'number' && Number.isFinite(value));
}

export function metricSummary(values: Array<number | null | undefined>): MetricSummary {
  const valid = nullableValues(values);
  if (valid.length === 0) return { count: 0, average: null, minimum: null, maximum: null };
  return {
    count: valid.length,
    average: round(sum(valid) / valid.length),
    minimum: Math.min(...valid),
    maximum: Math.max(...valid),
  };
}

function average(values: Array<number | null | undefined>): number | null {
  return metricSummary(values).average;
}

function daysBetween(startDate: string, endDate: string): number | null {
  const start = new Date(`${startDate}T00:00:00.000Z`);
  const end = new Date(endDate);
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) return null;
  return Math.max(0, Math.floor((end.getTime() - start.getTime()) / 86_400_000));
}

function groupBy<T>(records: T[], key: (record: T) => string): Map<string, T[]> {
  const groups = new Map<string, T[]>();
  for (const record of records) {
    const groupKey = key(record);
    groups.set(groupKey, [...(groups.get(groupKey) ?? []), record]);
  }
  return groups;
}

function groupAnalytics(
  id: string,
  label: string,
  plants: PlantCultivationAnalytics[],
): GroupCultivationAnalytics {
  const harvested = plants.filter((plant) => plant.harvestEvents > 0 || plant.status === 'harvested');
  const harvestEvents = sum(plants.map((plant) => plant.harvestEvents));
  const trimmed = sum(plants.map((plant) => plant.trimmedWeightG));
  const outcomeCount = sum(plants.map((plant) => plant.outcomes));
  const resolvedCount = sum(plants.map((plant) => plant.resolvedOutcomes));
  return {
    id,
    label,
    plants: plants.length,
    activePlants: plants.filter((plant) => plant.status === 'active').length,
    harvestedPlants: harvested.length,
    irrigationEvents: sum(plants.map((plant) => plant.irrigationEvents)),
    appliedLiters: round(sum(plants.map((plant) => plant.appliedLiters))),
    feedingEvents: sum(plants.map((plant) => plant.feedingEvents)),
    harvestEvents,
    totalTrimmedWeightG: round(trimmed, 1),
    averageTrimmedWeightPerHarvestG: harvestEvents > 0 ? round(trimmed / harvestEvents, 1) : null,
    averageRunoffPercent: average(plants.map((plant) => plant.averageRunoffPercent)),
    observationResolutionPercent: outcomeCount > 0 ? round((resolvedCount / outcomeCount) * 100, 1) : null,
  };
}

function sortedGroups(groups: Map<string, PlantCultivationAnalytics[]>, labelFor: (id: string, records: PlantCultivationAnalytics[]) => string): GroupCultivationAnalytics[] {
  return [...groups.entries()]
    .map(([id, records]) => groupAnalytics(id, labelFor(id, records), records))
    .sort((first, second) => second.totalTrimmedWeightG - first.totalTrimmedWeightG || first.label.localeCompare(second.label));
}

export function buildCultivationAnalytics(value: unknown, now = new Date()): CultivationAnalytics {
  const state: GrowLensState = normalizeState(value);
  const plants = state.plants.map((plant): PlantCultivationAnalytics => {
    const irrigation = state.irrigationRecords.filter((record) => record.plantId === plant.id);
    const feeding = state.feedingRecords.filter((record) => record.plantId === plant.id);
    const harvests = state.harvestRecords.filter((record) => record.plantId === plant.id);
    const observations = state.observations.filter((record) => record.plantId === plant.id);
    const outcomes = state.observationOutcomes.filter((record) => record.plantId === plant.id);
    const cycle = state.cycles.find((record) => record.id === plant.cycleId);
    const space = state.spaces.find((record) => record.id === plant.spaceId);
    const latestFeed = [...feeding].sort((a, b) => b.createdAt.localeCompare(a.createdAt))[0];
    const wetWeightG = sum(nullableValues(harvests.map((record) => record.wetWeightG)));
    const dryWeightG = sum(nullableValues(harvests.map((record) => record.dryWeightG)));
    const trimmedWeightG = sum(nullableValues(harvests.map((record) => record.trimmedWeightG)));
    const wasteWeightG = sum(nullableValues(harvests.map((record) => record.wasteWeightG)));
    const finalHarvestDate = [...harvests].sort((a, b) => b.harvestDate.localeCompare(a.harvestDate))[0]?.harvestDate;
    const ageDays = daysBetween(plant.startDate, finalHarvestDate ? `${finalHarvestDate}T12:00:00.000Z` : now.toISOString());
    const wetToDry = harvests.length === 1
      ? harvestDryLossPercent(harvests[0])
      : wetWeightG > 0 && dryWeightG > 0 ? round((1 - (dryWeightG / wetWeightG)) * 100, 1) : null;
    return {
      plantId: plant.id,
      name: plant.name,
      cultivar: plant.strain,
      status: plant.status,
      stage: plant.stage,
      cycleId: plant.cycleId,
      cycleName: cycle?.name ?? 'No cycle',
      spaceId: plant.spaceId,
      spaceName: space?.name ?? 'No space',
      ageDays,
      irrigationEvents: irrigation.length,
      appliedLiters: round(sum(irrigation.map((record) => record.volumeAppliedMl)) / 1000),
      runoffLiters: round(sum(nullableValues(irrigation.map((record) => record.runoffVolumeMl))) / 1000),
      averageRunoffPercent: average(irrigation.map(irrigationRunoffPercent)),
      inputPh: metricSummary(irrigation.map((record) => record.inputPh)),
      inputEcMsCm: metricSummary(irrigation.map((record) => record.inputEcMsCm)),
      runoffPh: metricSummary(irrigation.map((record) => record.runoffPh)),
      runoffEcMsCm: metricSummary(irrigation.map((record) => record.runoffEcMsCm)),
      feedingEvents: feeding.length,
      latestFeedPh: latestFeed?.finalPh ?? null,
      latestFeedEcMsCm: latestFeed?.finalEcMsCm ?? null,
      harvestEvents: harvests.length,
      wetWeightG: round(wetWeightG, 1),
      dryWeightG: round(dryWeightG, 1),
      trimmedWeightG: round(trimmedWeightG, 1),
      wasteWeightG: round(wasteWeightG, 1),
      wetToDryLossPercent: wetToDry,
      yieldPerDayG: ageDays && ageDays > 0 && trimmedWeightG > 0 ? round(trimmedWeightG / ageDays, 2) : null,
      observations: observations.length,
      outcomes: outcomes.length,
      resolvedOutcomes: outcomes.filter((record) => record.status === 'resolved').length,
    };
  }).sort((first, second) => second.trimmedWeightG - first.trimmedWeightG || first.name.localeCompare(second.name));

  const allRunoff = state.irrigationRecords.map(irrigationRunoffPercent);
  const resolvedObservationCount = state.observationOutcomes.filter((record) => record.status === 'resolved').length;
  const overall: OverallCultivationAnalytics = {
    activePlants: state.plants.filter((plant) => plant.status === 'active').length,
    harvestedPlants: state.plants.filter((plant) => plant.status === 'harvested').length,
    totalAppliedLiters: round(sum(state.irrigationRecords.map((record) => record.volumeAppliedMl)) / 1000),
    totalRunoffLiters: round(sum(nullableValues(state.irrigationRecords.map((record) => record.runoffVolumeMl))) / 1000),
    averageRunoffPercent: average(allRunoff),
    feedingEvents: state.feedingRecords.length,
    harvestEvents: state.harvestRecords.length,
    totalWetWeightG: round(sum(nullableValues(state.harvestRecords.map((record) => record.wetWeightG))), 1),
    totalDryWeightG: round(sum(nullableValues(state.harvestRecords.map((record) => record.dryWeightG))), 1),
    totalTrimmedWeightG: round(sum(nullableValues(state.harvestRecords.map((record) => record.trimmedWeightG))), 1),
    totalWasteWeightG: round(sum(nullableValues(state.harvestRecords.map((record) => record.wasteWeightG))), 1),
    observationCount: state.observations.length,
    resolvedObservationCount,
    observationResolutionPercent: state.observationOutcomes.length > 0
      ? round((resolvedObservationCount / state.observationOutcomes.length) * 100, 1)
      : null,
  };

  return {
    overall,
    plants,
    cultivars: sortedGroups(groupBy(plants, (plant) => plant.cultivar || 'Unknown cultivar'), (id) => id),
    cycles: sortedGroups(groupBy(plants, (plant) => plant.cycleId || 'no-cycle'), (_id, records) => records[0]?.cycleName ?? 'No cycle'),
    spaces: sortedGroups(groupBy(plants, (plant) => plant.spaceId || 'no-space'), (_id, records) => records[0]?.spaceName ?? 'No space'),
  };
}

function csvCell(value: unknown): string {
  const text = value === null || value === undefined ? '' : String(value);
  return /[",\r\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

export function createPlantAnalyticsCsv(analytics: CultivationAnalytics): string {
  const headers = [
    'plantId', 'name', 'cultivar', 'status', 'stage', 'cycle', 'space', 'ageDays',
    'irrigationEvents', 'appliedLiters', 'runoffLiters', 'averageRunoffPercent',
    'averageInputPh', 'averageInputEcMsCm', 'averageRunoffPh', 'averageRunoffEcMsCm',
    'feedingEvents', 'latestFeedPh', 'latestFeedEcMsCm', 'harvestEvents',
    'wetWeightG', 'dryWeightG', 'trimmedWeightG', 'wasteWeightG',
    'wetToDryLossPercent', 'yieldPerDayG', 'observations', 'outcomes', 'resolvedOutcomes',
  ];
  const rows = analytics.plants.map((plant) => [
    plant.plantId, plant.name, plant.cultivar, plant.status, plant.stage, plant.cycleName,
    plant.spaceName, plant.ageDays, plant.irrigationEvents, plant.appliedLiters,
    plant.runoffLiters, plant.averageRunoffPercent, plant.inputPh.average,
    plant.inputEcMsCm.average, plant.runoffPh.average, plant.runoffEcMsCm.average,
    plant.feedingEvents, plant.latestFeedPh, plant.latestFeedEcMsCm, plant.harvestEvents,
    plant.wetWeightG, plant.dryWeightG, plant.trimmedWeightG, plant.wasteWeightG,
    plant.wetToDryLossPercent, plant.yieldPerDayG, plant.observations, plant.outcomes,
    plant.resolvedOutcomes,
  ]);
  return [headers, ...rows].map((row) => row.map(csvCell).join(',')).join('\r\n');
}
