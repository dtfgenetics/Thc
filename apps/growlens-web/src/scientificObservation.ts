import type { EnvironmentReading } from './types';

export const SCIENTIFIC_OBSERVATION_CONTRACT = Object.freeze({
  repository: 'dtfgenetics/Thc-dataset',
  path: 'dataset/schema/scientific-observation.schema.json',
  schemaId: 'https://dtfseeds.com/schemas/scientific-observation-v1.json',
  schemaTitle: 'THC Scientific Observation v1',
  gitBlobSha: '942a74fadb59a2dfe475d71190f6b685d7b81516',
  formulaRegistryPath: 'dataset/registry/formula_registry_v1.json',
  formulaRegistrySchemaVersion: 'thc-formula-registry-v1',
});

export const DLI_FORMULA_ID = 'FORM-DLI-PPFD-PHOTOPERIOD';

export type ScientificSubjectType =
  | 'plant'
  | 'sample'
  | 'grow'
  | 'zone'
  | 'environment'
  | 'solution'
  | 'substrate'
  | 'organ'
  | 'germplasm';

export type ScientificReviewState = 'raw' | 'staged' | 'reviewed' | 'published' | 'quarantined';
export type ScientificSourceType = 'sensor' | 'user' | 'protocol' | 'dataset' | 'publication' | 'derived';

export type ScientificObservation = {
  observation_id: string;
  subject: {
    subject_type: ScientificSubjectType;
    subject_id: string;
    plant_id?: string;
    grow_id?: string;
    zone_id?: string;
  };
  observed_at?: string;
  observed_property: {
    property_id: string;
    label: string;
    trait_id?: string;
    ontology_ids?: string[];
  };
  method: {
    method_id: string;
    label: string;
    procedure_version?: string;
    instrument_id?: string;
    calibration_id?: string;
  };
  measurement: {
    original_value: number;
    original_unit: string;
    canonical_value?: number;
    canonical_unit?: string;
    qudt_unit_iri?: string;
    scale_id?: string;
    uncertainty?: number;
    quality_flag?: 'accepted' | 'estimated' | 'suspect' | 'rejected';
    derived?: boolean;
    formula_id?: string;
  };
  context?: Record<string, unknown>;
  media_ids?: string[];
  provenance: {
    source_type: ScientificSourceType;
    source_id: string;
    source_record_hash?: string;
    drive_evidence_id?: string;
  };
  review_state: ScientificReviewState;
};

type MeasurementSpec = {
  suffix: string;
  propertyId: string;
  label: string;
  value: number;
  unit: string;
  qudtUnitIri?: string;
};

function subjectFor(reading: EnvironmentReading): ScientificObservation['subject'] {
  const spaceId = reading.spaceId?.trim() || null;
  return {
    subject_type: 'environment',
    subject_id: spaceId ? `space:${spaceId}` : `environment-reading:${reading.id}`,
    ...(spaceId ? { zone_id: spaceId } : {}),
  };
}

function measuredObservation(reading: EnvironmentReading, spec: MeasurementSpec): ScientificObservation {
  return {
    observation_id: `OBS-growlens:${reading.id}:${spec.suffix}`,
    subject: subjectFor(reading),
    observed_at: reading.createdAt,
    observed_property: {
      property_id: spec.propertyId,
      label: spec.label,
    },
    method: {
      method_id: 'growlens.environment-reading-v1',
      label: 'GrowLens environment reading',
      procedure_version: '1',
    },
    measurement: {
      original_value: spec.value,
      original_unit: spec.unit,
      canonical_value: spec.value,
      canonical_unit: spec.unit,
      ...(spec.qudtUnitIri ? { qudt_unit_iri: spec.qudtUnitIri } : {}),
      derived: false,
    },
    context: {
      growlens_record_type: 'EnvironmentReading',
      growlens_reading_id: reading.id,
    },
    provenance: {
      source_type: 'user',
      source_id: `growlens:environment-reading:${reading.id}`,
    },
    review_state: 'raw',
  };
}

export function environmentReadingToScientificObservations(reading: EnvironmentReading): ScientificObservation[] {
  const specs: MeasurementSpec[] = [
    {
      suffix: 'air-temperature',
      propertyId: 'environment.air-temperature',
      label: 'Air temperature',
      value: reading.temperatureC,
      unit: 'degC',
      qudtUnitIri: 'http://qudt.org/vocab/unit/DEG_C',
    },
    {
      suffix: 'relative-humidity',
      propertyId: 'environment.relative-humidity',
      label: 'Relative humidity',
      value: reading.humidity,
      unit: '%RH',
    },
  ];

  if (reading.ppfd !== null) {
    specs.push({
      suffix: 'ppfd',
      propertyId: 'light.ppfd',
      label: 'Photosynthetic photon flux density',
      value: reading.ppfd,
      unit: 'umol/m2/s',
      qudtUnitIri: 'http://qudt.org/vocab/unit/MicroMOL-PER-M2-SEC',
    });
  }

  return specs.map((spec) => measuredObservation(reading, spec));
}

export function environmentReadingToDliObservation(
  reading: EnvironmentReading,
  photoperiodHours: number,
): ScientificObservation | null {
  if (reading.ppfd === null) return null;
  if (!Number.isFinite(photoperiodHours) || photoperiodHours <= 0 || photoperiodHours > 24) {
    throw new RangeError('photoperiodHours must be greater than 0 and no more than 24.');
  }

  const dli = reading.ppfd * photoperiodHours * 3600 / 1_000_000;
  return {
    observation_id: `OBS-growlens:${reading.id}:dli`,
    subject: subjectFor(reading),
    observed_at: reading.createdAt,
    observed_property: {
      property_id: 'light.daily-light-integral',
      label: 'Daily light integral',
    },
    method: {
      method_id: 'growlens.formula-dli-v1',
      label: 'GrowLens DLI calculation from average PPFD and photoperiod',
      procedure_version: '1',
    },
    measurement: {
      original_value: dli,
      original_unit: 'mol/m2/day',
      canonical_value: dli,
      canonical_unit: 'mol/m2/day',
      qudt_unit_iri: 'http://qudt.org/vocab/unit/MOL-PER-M2-DAY',
      derived: true,
      formula_id: DLI_FORMULA_ID,
    },
    context: {
      growlens_record_type: 'EnvironmentReading',
      growlens_reading_id: reading.id,
      input_ppfd_umol_m2_s: reading.ppfd,
      input_photoperiod_hours: photoperiodHours,
      assumption: 'PPFD is treated as the time-average over the stated photoperiod.',
    },
    provenance: {
      source_type: 'derived',
      source_id: `growlens:derived-dli:${reading.id}`,
    },
    review_state: 'raw',
  };
}

export function validateScientificObservationEnvelope(value: ScientificObservation): string[] {
  const errors: string[] = [];
  if (!/^OBS-[A-Za-z0-9._:-]+$/.test(value.observation_id)) errors.push('observation_id');
  if (!value.subject?.subject_type || !value.subject?.subject_id) errors.push('subject');
  if (!value.observed_property?.property_id || !value.observed_property?.label) errors.push('observed_property');
  if (!value.method?.method_id || !value.method?.label) errors.push('method');
  if (!Number.isFinite(value.measurement?.original_value) || !value.measurement?.original_unit) errors.push('measurement');
  if (value.measurement?.derived === true && !value.measurement.formula_id) errors.push('measurement.formula_id');
  if (!value.provenance?.source_type || !value.provenance?.source_id) errors.push('provenance');
  if (!['raw', 'staged', 'reviewed', 'published', 'quarantined'].includes(value.review_state)) errors.push('review_state');
  return errors;
}
