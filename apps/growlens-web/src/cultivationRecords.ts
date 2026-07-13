import type {
  FeedingRecord,
  HarvestRecord,
  IrrigationRecord,
  NutrientProduct,
  ObservationOutcome,
  ObservationOutcomeStatus,
  PpmScale,
  ReservoirRecord,
} from './types';

const OUTCOME_STATUSES = new Set<ObservationOutcomeStatus>(['monitoring', 'confirmed', 'ruled-out', 'resolved']);
const RECORD_ID_PATTERN = /^[a-z]+-[A-Za-z0-9-]{6,150}$/;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function text(value: unknown, maximum = 500): string {
  return typeof value === 'string' ? value.trim().slice(0, maximum) : '';
}

function identifier(value: unknown): string {
  const candidate = text(value, 160);
  return RECORD_ID_PATTERN.test(candidate) ? candidate : '';
}

function optionalIdentifier(value: unknown): string | null {
  const candidate = identifier(value);
  return candidate || null;
}

function stringList(value: unknown, maximumItems = 50, maximumLength = 200): string[] {
  if (!Array.isArray(value)) return [];
  return value
    .filter((item): item is string => typeof item === 'string')
    .map((item) => item.trim().slice(0, maximumLength))
    .filter(Boolean)
    .slice(0, maximumItems);
}

function nullableNumber(value: unknown, minimum: number, maximum: number): number | null {
  if (value === null || value === undefined || value === '') return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed >= minimum && parsed <= maximum ? parsed : null;
}

function requiredNumber(value: unknown, minimum: number, maximum: number): number | null {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed >= minimum && parsed <= maximum ? parsed : null;
}

function isoDateTime(value: unknown, fallback = new Date().toISOString()): string {
  const candidate = text(value, 50);
  return candidate && !Number.isNaN(new Date(candidate).getTime()) ? candidate : fallback;
}

function optionalIsoDateTime(value: unknown): string | null {
  const candidate = text(value, 50);
  return candidate && !Number.isNaN(new Date(candidate).getTime()) ? candidate : null;
}

function dateOnly(value: unknown): string {
  const candidate = text(value, 20);
  return /^\d{4}-\d{2}-\d{2}$/.test(candidate) ? candidate : '';
}

function normalizeProducts(value: unknown): NutrientProduct[] {
  if (!Array.isArray(value)) return [];
  return value.flatMap((item) => {
    if (!isRecord(item)) return [];
    const name = text(item.name, 120);
    if (!name) return [];
    return [{
      name,
      amount: nullableNumber(item.amount, 0, 1_000_000),
      unit: text(item.unit, 40),
    }];
  }).slice(0, 50);
}

export function normalizeIrrigationRecords(value: unknown): IrrigationRecord[] {
  if (!Array.isArray(value)) return [];
  return value.flatMap((item) => {
    if (!isRecord(item)) return [];
    const id = identifier(item.id);
    const volumeAppliedMl = requiredNumber(item.volumeAppliedMl, 1, 10_000_000);
    if (!id || volumeAppliedMl === null) return [];
    const createdAt = isoDateTime(item.createdAt);
    return [{
      id,
      plantId: optionalIdentifier(item.plantId),
      cycleId: optionalIdentifier(item.cycleId),
      spaceId: optionalIdentifier(item.spaceId),
      sourceWater: text(item.sourceWater, 120),
      volumeAppliedMl,
      runoffVolumeMl: nullableNumber(item.runoffVolumeMl, 0, 10_000_000),
      inputPh: nullableNumber(item.inputPh, 0, 14),
      inputEcMsCm: nullableNumber(item.inputEcMsCm, 0, 20),
      runoffPh: nullableNumber(item.runoffPh, 0, 14),
      runoffEcMsCm: nullableNumber(item.runoffEcMsCm, 0, 20),
      substrateMoisturePercent: nullableNumber(item.substrateMoisturePercent, 0, 100),
      drybackPercent: nullableNumber(item.drybackPercent, 0, 100),
      irrigationTimeMinutes: nullableNumber(item.irrigationTimeMinutes, 0, 1440),
      reservoirId: optionalIdentifier(item.reservoirId),
      recipeNotes: text(item.recipeNotes, 2000),
      productsUsed: stringList(item.productsUsed),
      createdAt,
      updatedAt: isoDateTime(item.updatedAt, createdAt),
    }];
  });
}

export function normalizeFeedingRecords(value: unknown): FeedingRecord[] {
  if (!Array.isArray(value)) return [];
  return value.flatMap((item) => {
    if (!isRecord(item)) return [];
    const id = identifier(item.id);
    const waterVolumeMl = requiredNumber(item.waterVolumeMl, 1, 10_000_000);
    if (!id || waterVolumeMl === null) return [];
    const createdAt = isoDateTime(item.createdAt);
    const ppmScaleValue = Number(item.ppmScale);
    const ppmScale: PpmScale = ppmScaleValue === 500 || ppmScaleValue === 700 ? ppmScaleValue : null;
    return [{
      id,
      plantId: optionalIdentifier(item.plantId),
      cycleId: optionalIdentifier(item.cycleId),
      reservoirId: optionalIdentifier(item.reservoirId),
      waterVolumeMl,
      sourceWater: text(item.sourceWater, 120),
      startingEcMsCm: nullableNumber(item.startingEcMsCm, 0, 20),
      finalEcMsCm: nullableNumber(item.finalEcMsCm, 0, 20),
      finalPh: nullableNumber(item.finalPh, 0, 14),
      ppm: nullableNumber(item.ppm, 0, 20_000),
      ppmScale,
      products: normalizeProducts(item.products),
      additives: stringList(item.additives),
      mixingNotes: text(item.mixingNotes, 2000),
      createdAt,
      updatedAt: isoDateTime(item.updatedAt, createdAt),
    }];
  });
}

export function normalizeReservoirRecords(value: unknown): ReservoirRecord[] {
  if (!Array.isArray(value)) return [];
  return value.flatMap((item) => {
    if (!isRecord(item)) return [];
    const id = identifier(item.id);
    const name = text(item.name, 120);
    if (!id || !name) return [];
    const createdAt = isoDateTime(item.createdAt);
    return [{
      id,
      spaceId: optionalIdentifier(item.spaceId),
      name,
      sourceWater: text(item.sourceWater, 120),
      capacityLiters: nullableNumber(item.capacityLiters, 0, 100_000),
      currentVolumeLiters: nullableNumber(item.currentVolumeLiters, 0, 100_000),
      ph: nullableNumber(item.ph, 0, 14),
      ecMsCm: nullableNumber(item.ecMsCm, 0, 20),
      temperatureC: nullableNumber(item.temperatureC, -20, 80),
      mixedAt: optionalIsoDateTime(item.mixedAt),
      notes: text(item.notes, 2000),
      createdAt,
      updatedAt: isoDateTime(item.updatedAt, createdAt),
    }];
  });
}

export function normalizeHarvestRecords(value: unknown): HarvestRecord[] {
  if (!Array.isArray(value)) return [];
  return value.flatMap((item) => {
    if (!isRecord(item)) return [];
    const id = identifier(item.id);
    const plantId = identifier(item.plantId);
    const harvestDate = dateOnly(item.harvestDate);
    if (!id || !plantId || !harvestDate) return [];
    const createdAt = isoDateTime(item.createdAt);
    return [{
      id,
      plantId,
      cycleId: optionalIdentifier(item.cycleId),
      lotId: text(item.lotId, 120),
      harvestDate,
      wetWeightG: nullableNumber(item.wetWeightG, 0, 10_000_000),
      dryWeightG: nullableNumber(item.dryWeightG, 0, 10_000_000),
      trimmedWeightG: nullableNumber(item.trimmedWeightG, 0, 10_000_000),
      wasteWeightG: nullableNumber(item.wasteWeightG, 0, 10_000_000),
      dryingTemperatureC: nullableNumber(item.dryingTemperatureC, -20, 80),
      dryingHumidity: nullableNumber(item.dryingHumidity, 0, 100),
      dryingDays: nullableNumber(item.dryingDays, 0, 365),
      cureStartedAt: optionalIsoDateTime(item.cureStartedAt),
      cureCheckpoints: stringList(item.cureCheckpoints, 100, 300),
      finalPhotoIds: stringList(item.finalPhotoIds, 100, 160).filter((photoId) => photoId.startsWith('photo-')),
      notes: text(item.notes, 3000),
      createdAt,
      updatedAt: isoDateTime(item.updatedAt, createdAt),
    }];
  });
}

export function normalizeObservationOutcomes(value: unknown): ObservationOutcome[] {
  if (!Array.isArray(value)) return [];
  return value.flatMap((item) => {
    if (!isRecord(item)) return [];
    const id = identifier(item.id);
    const observationId = identifier(item.observationId);
    const status = text(item.status, 30) as ObservationOutcomeStatus;
    if (!id || !observationId || !OUTCOME_STATUSES.has(status)) return [];
    const createdAt = isoDateTime(item.createdAt);
    return [{
      id,
      observationId,
      plantId: optionalIdentifier(item.plantId),
      status,
      verifiedCause: text(item.verifiedCause, 500),
      actionTaken: text(item.actionTaken, 1500),
      outcomeNotes: text(item.outcomeNotes, 2000),
      resolvedAt: optionalIsoDateTime(item.resolvedAt),
      createdAt,
      updatedAt: isoDateTime(item.updatedAt, createdAt),
    }];
  });
}

export function irrigationRunoffPercent(record: IrrigationRecord): number | null {
  if (record.runoffVolumeMl === null || record.volumeAppliedMl <= 0) return null;
  return Math.round((record.runoffVolumeMl / record.volumeAppliedMl) * 10_000) / 100;
}

export function harvestDryLossPercent(record: HarvestRecord): number | null {
  if (record.wetWeightG === null || record.dryWeightG === null || record.wetWeightG <= 0) return null;
  return Math.round((1 - (record.dryWeightG / record.wetWeightG)) * 10_000) / 100;
}

export function validateIrrigationInput(record: Pick<IrrigationRecord, 'volumeAppliedMl' | 'runoffVolumeMl' | 'inputPh' | 'inputEcMsCm' | 'runoffPh' | 'runoffEcMsCm'>): string[] {
  const errors: string[] = [];
  if (!Number.isFinite(record.volumeAppliedMl) || record.volumeAppliedMl <= 0) errors.push('Volume applied must be greater than zero.');
  if (record.runoffVolumeMl !== null && record.runoffVolumeMl < 0) errors.push('Runoff volume cannot be negative.');
  for (const [label, value] of [['Input pH', record.inputPh], ['Runoff pH', record.runoffPh]] as const) {
    if (value !== null && (value < 0 || value > 14)) errors.push(`${label} must be between 0 and 14.`);
  }
  for (const [label, value] of [['Input EC', record.inputEcMsCm], ['Runoff EC', record.runoffEcMsCm]] as const) {
    if (value !== null && (value < 0 || value > 20)) errors.push(`${label} must be between 0 and 20 mS/cm.`);
  }
  return errors;
}

export function validateHarvestInput(record: Pick<HarvestRecord, 'plantId' | 'harvestDate' | 'wetWeightG' | 'dryWeightG' | 'trimmedWeightG' | 'wasteWeightG'>): string[] {
  const errors: string[] = [];
  if (!record.plantId) errors.push('Choose a plant.');
  if (!record.harvestDate) errors.push('Harvest date is required.');
  for (const [label, value] of [['Wet weight', record.wetWeightG], ['Dry weight', record.dryWeightG], ['Trimmed weight', record.trimmedWeightG], ['Waste weight', record.wasteWeightG]] as const) {
    if (value !== null && (!Number.isFinite(value) || value < 0)) errors.push(`${label} cannot be negative.`);
  }
  return errors;
}
