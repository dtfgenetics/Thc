import { describe, expect, it } from 'vitest';
import type { EnvironmentReading } from './types';
import {
  DLI_FORMULA_ID,
  SCIENTIFIC_OBSERVATION_CONTRACT,
  environmentReadingToDliObservation,
  environmentReadingToScientificObservations,
  validateScientificObservationEnvelope,
} from './scientificObservation';

const reading: EnvironmentReading = {
  id: 'reading-contract-fixture',
  spaceId: 'flower-a',
  temperatureC: 25,
  humidity: 58,
  ppfd: 500,
  createdAt: '2026-10-05T20:00:00.000Z',
};

describe('GrowLens scientific observation producer', () => {
  it('pins the canonical upstream observation contract', () => {
    expect(SCIENTIFIC_OBSERVATION_CONTRACT).toEqual({
      repository: 'dtfgenetics/Thc-dataset',
      path: 'dataset/schema/scientific-observation.schema.json',
      schemaId: 'https://dtfseeds.com/schemas/scientific-observation-v1.json',
      schemaTitle: 'THC Scientific Observation v1',
      gitBlobSha: '942a74fadb59a2dfe475d71190f6b685d7b81516',
      formulaRegistryPath: 'dataset/registry/formula_registry_v1.json',
      formulaRegistrySchemaVersion: 'thc-formula-registry-v1',
    });
  });

  it('emits schema-compatible measured observations without pretending they are derived', () => {
    const observations = environmentReadingToScientificObservations(reading);
    expect(observations).toHaveLength(3);
    expect(observations.map((value) => value.observed_property.property_id)).toEqual([
      'environment.air-temperature',
      'environment.relative-humidity',
      'light.ppfd',
    ]);
    for (const observation of observations) {
      expect(validateScientificObservationEnvelope(observation)).toEqual([]);
      expect(observation.measurement.derived).toBe(false);
      expect(observation.measurement.formula_id).toBeUndefined();
      expect(observation.provenance.source_type).toBe('user');
      expect(observation.review_state).toBe('raw');
    }
  });

  it('emits derived DLI with the canonical formula id and explicit assumptions', () => {
    const observation = environmentReadingToDliObservation(reading, 12);
    expect(observation).not.toBeNull();
    expect(validateScientificObservationEnvelope(observation!)).toEqual([]);
    expect(observation!.measurement).toMatchObject({
      original_value: 21.6,
      canonical_value: 21.6,
      original_unit: 'mol/m2/day',
      canonical_unit: 'mol/m2/day',
      derived: true,
      formula_id: DLI_FORMULA_ID,
    });
    expect(observation!.provenance.source_type).toBe('derived');
    expect(observation!.context).toMatchObject({
      input_ppfd_umol_m2_s: 500,
      input_photoperiod_hours: 12,
    });
  });

  it('omits PPFD/DLI when PPFD was not observed and rejects invalid photoperiods', () => {
    const noPpfd = { ...reading, ppfd: null };
    expect(environmentReadingToScientificObservations(noPpfd)).toHaveLength(2);
    expect(environmentReadingToDliObservation(noPpfd, 12)).toBeNull();
    expect(() => environmentReadingToDliObservation(reading, 0)).toThrow(RangeError);
    expect(() => environmentReadingToDliObservation(reading, 25)).toThrow(RangeError);
  });
});
