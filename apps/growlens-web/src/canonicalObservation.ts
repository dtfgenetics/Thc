import type { DiaryEntry, GrowLensState, Observation, ObservationPlantLocation, ObservationSeverity, ObservationTissue } from './types';

export const CANONICAL_OBSERVATION_EVENT = 'growlens:canonical-observation';

export type GrowLensCanonicalObservationRecord = {
  schema: 'thc-cultivation-record';
  version: 1;
  id: string;
  type: 'plant-observation';
  sourceType: 'growlens';
  toolId: 'growlens';
  sourceId: string;
  plantId: string | null;
  cycleId: string | null;
  spaceId: string | null;
  observationId: string;
  parentRecordId: null;
  zone: null;
  stage: string | null;
  cultivar: string | null;
  observedAt: string;
  metrics: Partial<Record<
    'temperatureC'
    | 'humidityPercent'
    | 'ppfdUmolM2S'
    | 'inputPh'
    | 'inputEcMsCm'
    | 'runoffPh'
    | 'runoffEcMsCm'
    | 'vwcPercent'
    | 'drybackPercent'
    | 'volumeMl',
    number
  >>;
  units: Partial<Record<
    'temperatureC'
    | 'humidityPercent'
    | 'ppfdUmolM2S'
    | 'inputPh'
    | 'inputEcMsCm'
    | 'runoffPh'
    | 'runoffEcMsCm'
    | 'vwcPercent'
    | 'drybackPercent'
    | 'volumeMl',
    string
  >>;
  values: {
    symptoms: string[];
    candidateDifferentials: string[];
    severity?: ObservationSeverity;
    locationOnPlant?: ObservationPlantLocation;
    tissue?: ObservationTissue;
    notes?: string;
    contextRecordIds?: string[];
    environmentObservedAt?: string;
    irrigationObservedAt?: string;
    feedingObservedAt?: string;
    recentInterventions?: string[];
  };
  mediaRefs: Array<{
    ref: string;
    kind: 'image';
    role: 'observation';
    capturedAt: string;
  }>;
  tags: string[];
  provenance: {
    method: 'growlens-observation';
    deviceModel: null;
    calibrationId: null;
    estimated: false;
    derived: boolean;
  };
};

type ObservationInput = {
  id: string;
  plantId: string | null;
  symptoms: string[];
  notes: string;
  candidateDifferentials: string[];
  severity?: ObservationSeverity | '';
  locationOnPlant?: ObservationPlantLocation | '';
  tissue?: ObservationTissue | '';
  photoIds: string[];
  observedAt: string;
};

function cleanText(value: unknown, max: number): string {
  return String(value ?? '').trim().replace(/\s+/g, ' ').slice(0, max);
}

function cleanList(values: string[], maxItems = 50, maxLength = 120): string[] {
  return [...new Set(values.map((value) => cleanText(value, maxLength)).filter(Boolean))].slice(0, maxItems);
}

function latestAtOrBefore<T extends { createdAt: string }>(
  rows: readonly T[],
  observedAt: string,
  predicate: (row: T) => boolean,
): T | undefined {
  const cutoff = Date.parse(observedAt);
  return rows
    .filter((row) => predicate(row) && Number.isFinite(Date.parse(row.createdAt)) && Date.parse(row.createdAt) <= cutoff)
    .sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt))[0];
}

function finiteMetric(value: number | null | undefined): number | undefined {
  return typeof value === 'number' && Number.isFinite(value) ? value : undefined;
}

function observationPlantId(value: string | null): value is string {
  return typeof value === 'string' && value.trim().length > 0;
}

export function createGrowLensObservationArtifacts(
  input: ObservationInput,
  state: Pick<GrowLensState, 'plants'> & Partial<Pick<GrowLensState, 'readings' | 'irrigationRecords' | 'feedingRecords' | 'diary'>>,
): {
  observation: Observation;
  diary: DiaryEntry;
  canonicalRecord: GrowLensCanonicalObservationRecord;
} {
  const plant = state.plants.find((candidate) => candidate.id === input.plantId);
  const symptoms = cleanList(input.symptoms);
  const candidateDifferentials = cleanList(input.candidateDifferentials);
  const photoIds = cleanList(input.photoIds, 24, 240);
  const notes = cleanText(input.notes, 4000);
  const severity = input.severity || undefined;
  const locationOnPlant = input.locationOnPlant || undefined;
  const tissue = input.tissue || undefined;
  const observedAt = new Date(input.observedAt).toISOString();

  const environment = plant?.spaceId
    ? latestAtOrBefore(state.readings ?? [], observedAt, (row) => row.spaceId === plant.spaceId)
    : undefined;
  const irrigation = observationPlantId(input.plantId)
    ? latestAtOrBefore(state.irrigationRecords ?? [], observedAt, (row) => row.plantId === input.plantId)
    : undefined;
  const feeding = observationPlantId(input.plantId)
    ? latestAtOrBefore(state.feedingRecords ?? [], observedAt, (row) => row.plantId === input.plantId)
    : undefined;
  const recentInterventions = (state.diary ?? [])
    .filter((entry) => entry.plantId === input.plantId
      && Number.isFinite(Date.parse(entry.createdAt))
      && Date.parse(entry.createdAt) <= Date.parse(observedAt)
      && ['watering', 'feeding', 'training', 'transplant', 'pest-check'].includes(entry.type))
    .sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt))
    .slice(0, 5)
    .map((entry) => `${entry.type} · ${entry.createdAt} · ${cleanText(entry.title, 80)}`);

  const metrics: GrowLensCanonicalObservationRecord['metrics'] = {};
  const units: GrowLensCanonicalObservationRecord['units'] = {};
  const addMetric = (key: keyof GrowLensCanonicalObservationRecord['metrics'], value: number | undefined, unit: string) => {
    if (value === undefined) return;
    metrics[key] = value;
    units[key] = unit;
  };
  addMetric('temperatureC', finiteMetric(environment?.temperatureC), 'C');
  addMetric('humidityPercent', finiteMetric(environment?.humidity), '%');
  addMetric('ppfdUmolM2S', finiteMetric(environment?.ppfd), 'umol/m2/s');
  addMetric('inputPh', finiteMetric(irrigation?.inputPh) ?? finiteMetric(feeding?.finalPh), 'pH');
  addMetric('inputEcMsCm', finiteMetric(irrigation?.inputEcMsCm) ?? finiteMetric(feeding?.finalEcMsCm), 'mS/cm');
  addMetric('runoffPh', finiteMetric(irrigation?.runoffPh), 'pH');
  addMetric('runoffEcMsCm', finiteMetric(irrigation?.runoffEcMsCm), 'mS/cm');
  addMetric('vwcPercent', finiteMetric(irrigation?.substrateMoisturePercent), '%');
  addMetric('drybackPercent', finiteMetric(irrigation?.drybackPercent), '%');
  addMetric('volumeMl', finiteMetric(irrigation?.volumeAppliedMl), 'mL');

  const contextRecordIds = cleanList([
    environment?.id ?? '',
    irrigation?.id ?? '',
    feeding?.id ?? '',
  ], 12, 120);

  const observation: Observation = {
    id: input.id,
    plantId: input.plantId || null,
    symptoms,
    notes,
    possibleCauses: candidateDifferentials,
    ...(severity ? { severity } : {}),
    ...(locationOnPlant ? { locationOnPlant } : {}),
    ...(tissue ? { tissue } : {}),
    photoIds,
    createdAt: observedAt,
  };

  const diary: DiaryEntry = {
    id: `entry-${input.id.replace(/^observation-/, '')}`,
    plantId: observation.plantId,
    cycleId: plant?.cycleId || null,
    type: 'photo',
    title: plant ? `Photo observation · ${plant.name}` : 'Photo observation',
    notes: notes || symptoms.join(', '),
    createdAt: observedAt,
  };

  const canonicalRecord: GrowLensCanonicalObservationRecord = {
    schema: 'thc-cultivation-record',
    version: 1,
    id: `record-${input.id}`,
    type: 'plant-observation',
    sourceType: 'growlens',
    toolId: 'growlens',
    sourceId: input.id,
    plantId: observation.plantId,
    cycleId: plant?.cycleId || null,
    spaceId: plant?.spaceId || null,
    observationId: input.id,
    parentRecordId: null,
    zone: null,
    stage: plant?.stage || null,
    cultivar: plant?.strain || null,
    observedAt,
    metrics,
    units,
    values: {
      symptoms,
      candidateDifferentials,
      ...(severity ? { severity } : {}),
      ...(locationOnPlant ? { locationOnPlant } : {}),
      ...(tissue ? { tissue } : {}),
      ...(notes ? { notes } : {}),
      ...(contextRecordIds.length ? { contextRecordIds } : {}),
      ...(environment ? { environmentObservedAt: environment.createdAt } : {}),
      ...(irrigation ? { irrigationObservedAt: irrigation.createdAt } : {}),
      ...(feeding ? { feedingObservedAt: feeding.createdAt } : {}),
      ...(recentInterventions.length ? { recentInterventions } : {}),
    },
    mediaRefs: photoIds.map((ref) => ({
      ref,
      kind: 'image',
      role: 'observation',
      capturedAt: observedAt,
    })),
    tags: symptoms,
    provenance: {
      method: 'growlens-observation',
      deviceModel: null,
      calibrationId: null,
      estimated: false,
      derived: contextRecordIds.length > 0 || recentInterventions.length > 0,
    },
  };

  return { observation, diary, canonicalRecord };
}

export function publishGrowLensCanonicalObservation(record: GrowLensCanonicalObservationRecord): void {
  if (typeof window === 'undefined') return;
  window.dispatchEvent(new CustomEvent<GrowLensCanonicalObservationRecord>(
    CANONICAL_OBSERVATION_EVENT,
    { detail: record },
  ));
}
