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
  metrics: Record<string, never>;
  units: Record<string, never>;
  values: {
    symptoms: string[];
    candidateDifferentials: string[];
    severity?: ObservationSeverity;
    locationOnPlant?: ObservationPlantLocation;
    tissue?: ObservationTissue;
    notes?: string;
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
    derived: false;
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

export function createGrowLensObservationArtifacts(
  input: ObservationInput,
  state: Pick<GrowLensState, 'plants'>,
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
    metrics: {},
    units: {},
    values: {
      symptoms,
      candidateDifferentials,
      ...(severity ? { severity } : {}),
      ...(locationOnPlant ? { locationOnPlant } : {}),
      ...(tissue ? { tissue } : {}),
      ...(notes ? { notes } : {}),
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
      derived: false,
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
