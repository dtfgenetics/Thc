import type { GrowLensState } from './types';

export const RESEARCH_EXPORT_FORMAT = 'thc-growlens-research-export';
export const RESEARCH_EXPORT_VERSION = 1 as const;

type AliasMaps = {
  spaces: Map<string, string>;
  cycles: Map<string, string>;
  plants: Map<string, string>;
  observations: Map<string, string>;
  reservoirs: Map<string, string>;
};

function aliasMap(ids: string[], prefix: string): Map<string, string> {
  return new Map(ids.map((id, index) => [id, `${prefix}-${String(index + 1).padStart(3, '0')}`]));
}

function alias(map: Map<string, string>, id: string | null | undefined): string | null {
  return id ? map.get(id) ?? null : null;
}

function timestampMs(value: string | null | undefined): number | null {
  if (!value) return null;
  const parsed = new Date(value).getTime();
  return Number.isFinite(parsed) ? parsed : null;
}

function baselineMs(state: GrowLensState): number {
  const values = [
    ...state.spaces.map((item) => item.createdAt),
    ...state.cycles.map((item) => item.startDate),
    ...state.plants.flatMap((item) => [item.startDate, item.createdAt]),
    ...state.diary.map((item) => item.createdAt),
    ...state.tasks.map((item) => item.createdAt),
    ...state.readings.map((item) => item.createdAt),
    ...state.calibrationProfiles.map((item) => item.createdAt),
    ...state.observations.map((item) => item.createdAt),
    ...state.irrigationRecords.flatMap((item) => [item.createdAt, item.updatedAt]),
    ...state.feedingRecords.flatMap((item) => [item.createdAt, item.updatedAt]),
    ...state.reservoirRecords.flatMap((item) => [item.createdAt, item.updatedAt, item.mixedAt ?? '']),
    ...state.harvestRecords.flatMap((item) => [item.harvestDate, item.createdAt, item.updatedAt, item.cureStartedAt ?? '']),
    ...state.observationOutcomes.flatMap((item) => [item.createdAt, item.updatedAt, item.resolvedAt ?? '']),
  ].map(timestampMs).filter((value): value is number => value !== null);
  return values.length ? Math.min(...values) : Date.now();
}

function dayOffset(value: string | null | undefined, base: number): number | null {
  const parsed = timestampMs(value);
  return parsed === null ? null : Math.floor((parsed - base) / 86_400_000);
}

const unsafeText = /(?:https?:\/\/|www\.|[\w.+-]+@[\w.-]+\.[A-Za-z]{2,}|(?:\+?\d[\s().-]*){7,})/i;

export function safeResearchLabel(value: string | null | undefined): string | null {
  const normalized = value?.trim().replace(/\s+/g, ' ') ?? '';
  if (!normalized || normalized.length > 80 || unsafeText.test(normalized)) return null;
  return normalized;
}

function safeLabels(values: string[]): string[] {
  return values.map(safeResearchLabel).filter((value): value is string => Boolean(value));
}

export type GrowLensResearchExport = ReturnType<typeof buildResearchExport>;

export function buildResearchExport(
  state: GrowLensState,
  publicationApproved: boolean,
  generatedAt = new Date().toISOString(),
) {
  const base = baselineMs(state);
  const maps: AliasMaps = {
    spaces: aliasMap(state.spaces.map((item) => item.id), 'space'),
    cycles: aliasMap(state.cycles.map((item) => item.id), 'cycle'),
    plants: aliasMap(state.plants.map((item) => item.id), 'plant'),
    observations: aliasMap(state.observations.map((item) => item.id), 'observation'),
    reservoirs: aliasMap(state.reservoirRecords.map((item) => item.id), 'reservoir'),
  };

  const records = {
    spaces: state.spaces.map((item) => ({
      spaceId: alias(maps.spaces, item.id),
      environment: item.environment,
      lightHours: item.lightHours,
      createdDay: dayOffset(item.createdAt, base),
    })),
    cycles: state.cycles.map((item) => ({
      cycleId: alias(maps.cycles, item.id),
      spaceId: alias(maps.spaces, item.spaceId),
      startDay: dayOffset(item.startDate, base),
      stage: item.stage,
      status: item.status,
    })),
    plants: state.plants.map((item) => ({
      plantId: alias(maps.plants, item.id),
      cultivar: safeResearchLabel(item.strain),
      stage: item.stage,
      status: item.status,
      spaceId: alias(maps.spaces, item.spaceId),
      cycleId: alias(maps.cycles, item.cycleId),
      startDay: dayOffset(item.startDate, base),
    })),
    diaryEvents: state.diary.map((item) => ({
      plantId: alias(maps.plants, item.plantId),
      cycleId: alias(maps.cycles, item.cycleId),
      type: item.type,
      day: dayOffset(item.createdAt, base),
    })),
    environmentReadings: state.readings.map((item) => ({
      spaceId: alias(maps.spaces, item.spaceId),
      temperatureC: item.temperatureC,
      humidityPercent: item.humidity,
      ppfdUmolM2S: item.ppfd,
      day: dayOffset(item.createdAt, base),
    })),
    calibrationProfiles: state.calibrationProfiles.map((item) => ({
      fixture: safeResearchLabel(item.fixture),
      luxToPpfdFactor: item.luxToPpfdFactor,
      day: dayOffset(item.createdAt, base),
    })),
    observations: state.observations.map((item) => ({
      observationId: alias(maps.observations, item.id),
      plantId: alias(maps.plants, item.plantId),
      symptoms: safeLabels(item.symptoms),
      possibleCauses: safeLabels(item.possibleCauses),
      day: dayOffset(item.createdAt, base),
    })),
    irrigation: state.irrigationRecords.map((item) => ({
      plantId: alias(maps.plants, item.plantId),
      cycleId: alias(maps.cycles, item.cycleId),
      spaceId: alias(maps.spaces, item.spaceId),
      reservoirId: alias(maps.reservoirs, item.reservoirId),
      volumeAppliedMl: item.volumeAppliedMl,
      runoffVolumeMl: item.runoffVolumeMl,
      inputPh: item.inputPh,
      inputEcMsCm: item.inputEcMsCm,
      runoffPh: item.runoffPh,
      runoffEcMsCm: item.runoffEcMsCm,
      substrateMoisturePercent: item.substrateMoisturePercent,
      drybackPercent: item.drybackPercent,
      irrigationTimeMinutes: item.irrigationTimeMinutes,
      productsUsed: safeLabels(item.productsUsed),
      day: dayOffset(item.createdAt, base),
    })),
    feeding: state.feedingRecords.map((item) => ({
      plantId: alias(maps.plants, item.plantId),
      cycleId: alias(maps.cycles, item.cycleId),
      reservoirId: alias(maps.reservoirs, item.reservoirId),
      waterVolumeMl: item.waterVolumeMl,
      startingEcMsCm: item.startingEcMsCm,
      finalEcMsCm: item.finalEcMsCm,
      finalPh: item.finalPh,
      ppm: item.ppm,
      ppmScale: item.ppmScale,
      products: item.products.map((product) => ({
        name: safeResearchLabel(product.name),
        amount: product.amount,
        unit: safeResearchLabel(product.unit),
      })).filter((product) => product.name !== null),
      additives: safeLabels(item.additives),
      day: dayOffset(item.createdAt, base),
    })),
    reservoirs: state.reservoirRecords.map((item) => ({
      reservoirId: alias(maps.reservoirs, item.id),
      spaceId: alias(maps.spaces, item.spaceId),
      capacityLiters: item.capacityLiters,
      currentVolumeLiters: item.currentVolumeLiters,
      ph: item.ph,
      ecMsCm: item.ecMsCm,
      temperatureC: item.temperatureC,
      mixedDay: dayOffset(item.mixedAt, base),
      day: dayOffset(item.createdAt, base),
    })),
    harvests: state.harvestRecords.map((item) => ({
      plantId: alias(maps.plants, item.plantId),
      cycleId: alias(maps.cycles, item.cycleId),
      harvestDay: dayOffset(item.harvestDate, base),
      wetWeightG: item.wetWeightG,
      dryWeightG: item.dryWeightG,
      trimmedWeightG: item.trimmedWeightG,
      wasteWeightG: item.wasteWeightG,
      dryingTemperatureC: item.dryingTemperatureC,
      dryingHumidityPercent: item.dryingHumidity,
      dryingDays: item.dryingDays,
      cureStartDay: dayOffset(item.cureStartedAt, base),
    })),
    observationOutcomes: state.observationOutcomes.map((item) => ({
      observationId: alias(maps.observations, item.observationId),
      plantId: alias(maps.plants, item.plantId),
      status: item.status,
      verifiedCause: safeResearchLabel(item.verifiedCause),
      resolvedDay: dayOffset(item.resolvedAt, base),
      day: dayOffset(item.createdAt, base),
    })),
  };

  const summary = Object.fromEntries(
    Object.entries(records).map(([key, value]) => [key, value.length]),
  );

  return {
    format: RESEARCH_EXPORT_FORMAT,
    version: RESEARCH_EXPORT_VERSION,
    generatedAt,
    source: {
      app: 'THC GrowLens',
      schemaVersion: state.schemaVersion,
      timeline: 'relative-day-offsets',
    },
    consent: {
      exportConfirmed: true,
      repositoryPublicationApproved: publicationApproved,
      scope: 'sanitized observational cultivation records',
    },
    privacy: {
      idPolicy: 'export-scoped aliases only',
      timePolicy: 'absolute timestamps removed; relative day offsets retained',
      excluded: [
        'account identity and authentication data',
        'plant, grow-space, cycle, reservoir, calibration, diary, and task names',
        'free-text notes, titles, recipes, actions, outcome narratives, and lot IDs',
        'photo IDs, image bytes, filenames, metadata, and private storage paths',
        'raw internal record IDs',
      ],
      safeLabelPolicy: 'trimmed <=80 characters; rejects email, URL, and phone-like text',
    },
    summary,
    records,
  };
}

export function serializeResearchExport(state: GrowLensState, publicationApproved: boolean): string {
  return JSON.stringify(buildResearchExport(state, publicationApproved), null, 2);
}
