import { calculateVpdKpa } from './calculations';
import type { EnvironmentReading, GrowLensState } from './types';

export type EventEnvironmentInsight = {
  id: string;
  kind: 'irrigation' | 'feeding';
  title: string;
  timestamp: string;
  spaceId: string | null;
  beforeCount: number;
  afterCount: number;
  before: { temperatureC: number; humidity: number; vpdKpa: number; ppfd: number | null };
  after: { temperatureC: number; humidity: number; vpdKpa: number; ppfd: number | null };
  delta: { temperatureC: number; humidity: number; vpdKpa: number; ppfd: number | null };
};

function round(value:number, decimals=2):number {
  const factor=10**decimals;
  return Math.round(value*factor)/factor;
}

function mean(values:number[]):number {
  return values.reduce((sum,value)=>sum+value,0)/values.length;
}

function summarize(readings:EnvironmentReading[]) {
  const ppfd=readings.flatMap((reading)=>reading.ppfd===null?[]:[reading.ppfd]);
  return {
    temperatureC:round(mean(readings.map((reading)=>reading.temperatureC)),2),
    humidity:round(mean(readings.map((reading)=>reading.humidity)),2),
    vpdKpa:round(mean(readings.map((reading)=>calculateVpdKpa(reading.temperatureC,reading.humidity))),3),
    ppfd:ppfd.length?round(mean(ppfd),1):null,
  };
}

function spaceForEvent(state:GrowLensState, plantId:string|null, directSpaceId:string|null, reservoirId:string|null):string|null {
  if(directSpaceId)return directSpaceId;
  if(plantId){
    const plant=state.plants.find((item)=>item.id===plantId);
    if(plant?.spaceId)return plant.spaceId;
  }
  if(reservoirId){
    const reservoir=state.reservoirRecords.find((item)=>item.id===reservoirId);
    if(reservoir?.spaceId)return reservoir.spaceId;
  }
  return null;
}

export function buildEventEnvironmentInsights(state:GrowLensState, windowHours=6, limit=12):EventEnvironmentInsight[] {
  const windowMs=Math.max(1,windowHours)*3_600_000;
  const events=[
    ...state.irrigationRecords.map((record)=>({
      id:record.id,kind:'irrigation' as const,timestamp:record.createdAt,
      title:`${record.volumeAppliedMl} mL irrigation`,
      spaceId:spaceForEvent(state,record.plantId,record.spaceId,record.reservoirId),
    })),
    ...state.feedingRecords.map((record)=>({
      id:record.id,kind:'feeding' as const,timestamp:record.createdAt,
      title:`${record.waterVolumeMl} mL feed mix`,
      spaceId:spaceForEvent(state,record.plantId,null,record.reservoirId),
    })),
  ].sort((a,b)=>b.timestamp.localeCompare(a.timestamp));

  const insights:EventEnvironmentInsight[]=[];
  for(const event of events){
    const eventTime=Date.parse(event.timestamp);
    if(!Number.isFinite(eventTime))continue;
    let resolvedSpaceId=event.spaceId;
    if(!resolvedSpaceId){
      const candidateSpaces=[...new Set(state.readings
        .filter((reading)=>Math.abs(Date.parse(reading.createdAt)-eventTime)<=windowMs)
        .map((reading)=>reading.spaceId)
        .filter((spaceId):spaceId is string=>Boolean(spaceId)))];
      if(candidateSpaces.length!==1)continue;
      [resolvedSpaceId]=candidateSpaces;
    }
    const readings=state.readings.filter((reading)=>{
      const readingTime=Date.parse(reading.createdAt);
      if(!Number.isFinite(readingTime))return false;
      if(reading.spaceId!==resolvedSpaceId)return false;
      return Math.abs(readingTime-eventTime)<=windowMs;
    });
    const before=readings.filter((reading)=>Date.parse(reading.createdAt)<eventTime);
    const after=readings.filter((reading)=>Date.parse(reading.createdAt)>eventTime);
    if(!before.length||!after.length)continue;
    const beforeSummary=summarize(before);
    const afterSummary=summarize(after);
    insights.push({
      ...event,
      spaceId:resolvedSpaceId,
      beforeCount:before.length,
      afterCount:after.length,
      before:beforeSummary,
      after:afterSummary,
      delta:{
        temperatureC:round(afterSummary.temperatureC-beforeSummary.temperatureC,2),
        humidity:round(afterSummary.humidity-beforeSummary.humidity,2),
        vpdKpa:round(afterSummary.vpdKpa-beforeSummary.vpdKpa,3),
        ppfd:beforeSummary.ppfd===null||afterSummary.ppfd===null?null:round(afterSummary.ppfd-beforeSummary.ppfd,1),
      },
    });
    if(insights.length>=limit)break;
  }
  return insights;
}
