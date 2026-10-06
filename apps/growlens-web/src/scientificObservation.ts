import type { GrowLensCanonicalObservationRecord } from './canonicalObservation';

export type ScientificObservationV1 = {
  observation_id: string;
  subject: {
    subject_type: 'plant' | 'grow' | 'zone' | 'environment' | 'solution' | 'substrate';
    subject_id: string;
    plant_id?: string;
    grow_id?: string;
    zone_id?: string;
  };
  observed_at: string;
  observed_property: {
    property_id: string;
    label: string;
  };
  method: {
    method_id: string;
    label: string;
    procedure_version: string;
  };
  measurement: {
    original_value: number;
    original_unit: string;
    canonical_value: number;
    canonical_unit: string;
    quality_flag: 'accepted';
    derived: false;
  };
  context: {
    growlens_observation_id: string;
    growlens_record_id: string;
    source_context_record_ids: string[];
    candidate_differentials: string[];
    symptoms: string[];
  };
  media_ids: string[];
  provenance: {
    source_type: 'derived';
    source_id: string;
  };
  review_state: 'raw';
};

const PROPERTY_LABELS: Record<string,string> = {
  temperatureC:'Air temperature',
  humidityPercent:'Relative humidity',
  ppfdUmolM2S:'Photosynthetic photon flux density',
  inputPh:'Irrigation input pH',
  inputEcMsCm:'Irrigation input electrical conductivity',
  runoffPh:'Runoff pH',
  runoffEcMsCm:'Runoff electrical conductivity',
  vwcPercent:'Substrate volumetric water content',
  drybackPercent:'Substrate dryback',
  volumeMl:'Irrigation volume applied',
};

function safeId(value:string):string {
  return value.replace(/[^A-Za-z0-9._:-]+/g,'-').replace(/^-+|-+$/g,'').slice(0,120) || 'unknown';
}

export function scientificObservationsFromGrowLens(
  record: GrowLensCanonicalObservationRecord,
): ScientificObservationV1[] {
  const subjectId = record.plantId || record.spaceId || record.cycleId || record.id;
  const subjectType: ScientificObservationV1['subject']['subject_type'] =
    record.plantId ? 'plant' : record.spaceId ? 'zone' : record.cycleId ? 'grow' : 'environment';
  const contextRecordIds = Array.isArray(record.values.contextRecordIds)
    ? record.values.contextRecordIds.slice(0,12)
    : [];
  const symptoms = Array.isArray(record.values.symptoms) ? record.values.symptoms.slice(0,50) : [];
  const candidateDifferentials = Array.isArray(record.values.candidateDifferentials)
    ? record.values.candidateDifferentials.slice(0,50)
    : [];

  return Object.entries(record.metrics).flatMap(([metric,value]) => {
    if (typeof value !== 'number' || !Number.isFinite(value)) return [];
    const unit = record.units[metric as keyof typeof record.units];
    if (typeof unit !== 'string' || !unit) return [];
    const id = `OBS-${safeId(record.observationId)}-${safeId(metric)}`;
    return [{
      observation_id:id,
      subject:{
        subject_type:subjectType,
        subject_id:subjectId,
        ...(record.plantId ? {plant_id:record.plantId} : {}),
        ...(record.cycleId ? {grow_id:record.cycleId} : {}),
        ...(record.spaceId ? {zone_id:record.spaceId} : {}),
      },
      observed_at:record.observedAt,
      observed_property:{
        property_id:`thc:${metric}`,
        label:PROPERTY_LABELS[metric] || metric,
      },
      method:{
        method_id:'growlens-context-adapter-v1',
        label:'GrowLens contextual measurement adapter',
        procedure_version:'1',
      },
      measurement:{
        original_value:value,
        original_unit:unit,
        canonical_value:value,
        canonical_unit:unit,
        quality_flag:'accepted',
        derived:false,
      },
      context:{
        growlens_observation_id:record.observationId,
        growlens_record_id:record.id,
        source_context_record_ids:contextRecordIds,
        candidate_differentials:candidateDifferentials,
        symptoms,
      },
      media_ids:record.mediaRefs.map(item=>item.ref),
      provenance:{
        source_type:'derived',
        source_id:record.id,
      },
      review_state:'raw',
    }];
  });
}
