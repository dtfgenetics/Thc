import { describe, expect, it } from 'vitest';
import type { GrowLensState } from './types';
import { buildEventEnvironmentInsights } from './eventEnvironmentInsights';

function baseState():GrowLensState {
  return {
    schemaVersion:2,
    spaces:[{id:'space-1',name:'Room 1',environment:'indoor',lightHours:18,createdAt:'2026-09-01T00:00:00.000Z'}],
    cycles:[],
    plants:[{id:'plant-1',name:'A',strain:'Test',stage:'vegetative',status:'active',spaceId:'space-1',cycleId:'',startDate:'2026-09-01',notes:'',createdAt:'2026-09-01T00:00:00.000Z'}],
    diary:[],tasks:[],calibrationProfiles:[],observations:[],reservoirRecords:[],harvestRecords:[],observationOutcomes:[],
    readings:[],
    irrigationRecords:[],
    feedingRecords:[],
  };
}

describe('GrowLens event/environment windows',()=>{
  it('compares readings before and after an irrigation in the same space',()=>{
    const state=baseState();
    state.readings=[
      {id:'r1',spaceId:'space-1',temperatureC:24,humidity:60,ppfd:400,createdAt:'2026-09-10T08:00:00.000Z'},
      {id:'r2',spaceId:'space-1',temperatureC:26,humidity:55,ppfd:500,createdAt:'2026-09-10T12:00:00.000Z'},
    ];
    state.irrigationRecords=[{
      id:'i1',plantId:'plant-1',cycleId:null,spaceId:'space-1',sourceWater:'',volumeAppliedMl:1000,runoffVolumeMl:null,
      inputPh:null,inputEcMsCm:null,runoffPh:null,runoffEcMsCm:null,substrateMoisturePercent:null,drybackPercent:null,
      irrigationTimeMinutes:null,reservoirId:null,recipeNotes:'',productsUsed:[],
      createdAt:'2026-09-10T10:00:00.000Z',updatedAt:'2026-09-10T10:00:00.000Z'
    }];
    const result=buildEventEnvironmentInsights(state,6);
    expect(result).toHaveLength(1);
    expect(result[0].delta.temperatureC).toBe(2);
    expect(result[0].delta.humidity).toBe(-5);
    expect(result[0].beforeCount).toBe(1);
    expect(result[0].afterCount).toBe(1);
  });

  it('does not compare across unrelated grow spaces',()=>{
    const state=baseState();
    state.spaces.push({id:'space-2',name:'Room 2',environment:'indoor',lightHours:18,createdAt:'2026-09-01T00:00:00.000Z'});
    state.readings=[
      {id:'r1',spaceId:'space-2',temperatureC:20,humidity:70,ppfd:null,createdAt:'2026-09-10T08:00:00.000Z'},
      {id:'r2',spaceId:'space-2',temperatureC:21,humidity:69,ppfd:null,createdAt:'2026-09-10T12:00:00.000Z'},
    ];
    state.irrigationRecords=[{
      id:'i1',plantId:'plant-1',cycleId:null,spaceId:'space-1',sourceWater:'',volumeAppliedMl:1000,runoffVolumeMl:null,
      inputPh:null,inputEcMsCm:null,runoffPh:null,runoffEcMsCm:null,substrateMoisturePercent:null,drybackPercent:null,
      irrigationTimeMinutes:null,reservoirId:null,recipeNotes:'',productsUsed:[],
      createdAt:'2026-09-10T10:00:00.000Z',updatedAt:'2026-09-10T10:00:00.000Z'
    }];
    expect(buildEventEnvironmentInsights(state,6)).toEqual([]);
  });

  it('requires both a before and after reading',()=>{
    const state=baseState();
    state.readings=[{id:'r1',spaceId:'space-1',temperatureC:24,humidity:60,ppfd:400,createdAt:'2026-09-10T08:00:00.000Z'}];
    state.feedingRecords=[{
      id:'f1',plantId:'plant-1',cycleId:null,reservoirId:null,waterVolumeMl:1000,sourceWater:'',startingEcMsCm:null,finalEcMsCm:null,
      finalPh:null,ppm:null,ppmScale:null,products:[],additives:[],mixingNotes:'',createdAt:'2026-09-10T10:00:00.000Z',updatedAt:'2026-09-10T10:00:00.000Z'
    }];
    expect(buildEventEnvironmentInsights(state,6)).toEqual([]);
  });
});
