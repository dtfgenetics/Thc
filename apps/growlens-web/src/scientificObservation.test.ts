import { describe, expect, it } from 'vitest';
import { createGrowLensObservationArtifacts } from './canonicalObservation';
import { scientificObservationsFromGrowLens } from './scientificObservation';

describe('GrowLens scientific observation contract adapter', () => {
  it('emits numeric scientific observations while preserving measured-vs-derived boundaries', () => {
    const { canonicalRecord } = createGrowLensObservationArtifacts({
      id:'observation-contract',
      plantId:'plant-1',
      symptoms:['chlorosis'],
      notes:'',
      candidateDifferentials:['Root-zone stress'],
      photoIds:['photo-1'],
      observedAt:'2026-10-05T12:00:00.000Z',
    }, {
      plants:[{
        id:'plant-1',name:'Plant 1',strain:'Blue Mango',stage:'vegetative',status:'active',
        spaceId:'space-1',cycleId:'cycle-1',startDate:'2026-09-01',notes:'',createdAt:'2026-09-01T00:00:00.000Z',
      }],
      readings:[{id:'reading-1',spaceId:'space-1',temperatureC:25,humidity:60,ppfd:500,createdAt:'2026-10-05T11:55:00.000Z'}],
      irrigationRecords:[],
      feedingRecords:[],
      diary:[],
    });

    expect(canonicalRecord.provenance.derived).toBe(true);
    const observations=scientificObservationsFromGrowLens(canonicalRecord);
    expect(observations).toHaveLength(3);
    const temperature=observations.find(item=>item.observed_property.property_id==='thc:temperatureC');
    expect(temperature).toMatchObject({
      observation_id:'OBS-observation-contract-temperatureC',
      subject:{subject_type:'plant',subject_id:'plant-1',plant_id:'plant-1',grow_id:'cycle-1',zone_id:'space-1'},
      observed_at:'2026-10-05T12:00:00.000Z',
      measurement:{original_value:25,original_unit:'C',canonical_value:25,canonical_unit:'C',quality_flag:'accepted',derived:false},
      provenance:{source_type:'derived',source_id:canonicalRecord.id},
      review_state:'raw',
    });
    expect(temperature?.context.source_context_record_ids).toContain('reading-1');
    expect(temperature?.context.candidate_differentials).toEqual(['Root-zone stress']);
    expect(temperature?.media_ids).toEqual(['photo-1']);
  });

  it('does not coerce qualitative symptoms into numeric scientific observations', () => {
    const { canonicalRecord } = createGrowLensObservationArtifacts({
      id:'observation-qualitative',
      plantId:null,
      symptoms:['spots'],
      notes:'visual only',
      candidateDifferentials:['Possible pest pressure'],
      photoIds:[],
      observedAt:'2026-10-05T12:00:00.000Z',
    }, {plants:[]});
    expect(scientificObservationsFromGrowLens(canonicalRecord)).toEqual([]);
  });
});
