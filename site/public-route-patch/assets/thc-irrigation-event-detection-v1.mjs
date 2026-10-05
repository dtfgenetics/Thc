const finite=value=>{const n=Number(value);return Number.isFinite(n)?n:null};

export function normalizeIrrigationSample(input={}){
  const observedAt=input?.observedAt?new Date(input.observedAt):null;
  const vwc=finite(input?.vwc ?? input?.metrics?.vwc);
  if(!observedAt||!Number.isFinite(observedAt.getTime())||vwc===null)return null;
  return {
    observedAt:observedAt.toISOString(),
    deviceId:String(input?.deviceId||'unspecified').trim()||'unspecified',
    zone:String(input?.zone||'').trim(),
    vwc
  };
}

export function detectIrrigationCandidates(samples=[],{
  minRise=3,
  maxGapMinutes=30,
  mergeWindowMinutes=0
}={}){
  const riseThreshold=Math.max(0,Number(minRise)||0);
  const maxGapMs=Math.max(0,Number(maxGapMinutes)||0)*60000;
  const mergeWindowMs=Math.max(0,Number(mergeWindowMinutes)||0)*60000;
  const rows=(Array.isArray(samples)?samples:[])
    .map(normalizeIrrigationSample)
    .filter(Boolean)
    .sort((a,b)=>Date.parse(a.observedAt)-Date.parse(b.observedAt));
  const previousByDevice=new Map(),candidates=[];
  for(const row of rows){
    const prev=previousByDevice.get(row.deviceId);
    previousByDevice.set(row.deviceId,row);
    if(!prev)continue;
    const gapMs=Date.parse(row.observedAt)-Date.parse(prev.observedAt);
    if(!(gapMs>0)||gapMs>maxGapMs)continue;
    const rise=row.vwc-prev.vwc;
    if(rise<riseThreshold)continue;
    const last=candidates.at(-1);
    if(mergeWindowMs>0&&last&&last.deviceId===row.deviceId&&Date.parse(row.observedAt)-Date.parse(last.endAt)<=mergeWindowMs){
      last.endAt=row.observedAt;last.afterVwc=row.vwc;last.rise=row.vwc-last.beforeVwc;last.gapMinutes=(Date.parse(last.endAt)-Date.parse(last.startAt))/60000;last.zone=row.zone||last.zone;continue;
    }
    candidates.push({id:[row.deviceId,prev.observedAt,row.observedAt].join('::'),deviceId:row.deviceId,zone:row.zone||prev.zone||'',startAt:prev.observedAt,endAt:row.observedAt,beforeVwc:prev.vwc,afterVwc:row.vwc,rise,gapMinutes:gapMs/60000,status:'candidate'});
  }
  return candidates;
}
