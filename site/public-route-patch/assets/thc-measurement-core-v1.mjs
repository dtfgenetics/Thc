const finite=(value,label)=>{const n=Number(value);if(!Number.isFinite(n))throw new RangeError(`${label} must be a finite number`);return n};

export function normalizeHeader(value){
  return String(value??'').trim().toLowerCase().replace(/[^a-z0-9]+/g,'_').replace(/^_+|_+$/g,'');
}

export function calibrationAgeDays(dateValue,now=new Date()){
  const raw=String(dateValue??'').trim();
  if(!/^\d{4}-\d{2}-\d{2}$/.test(raw))return null;
  const at=new Date(raw+'T12:00:00');
  const ref=now instanceof Date?now:new Date(now);
  if(Number.isNaN(at.getTime())||Number.isNaN(ref.getTime()))return null;
  return Math.max(0,Math.floor((ref.getTime()-at.getTime())/86400000));
}

export function readingFreshness(observedAt,{now=Date.now(),staleAfterMs=15*60*1000}={}){
  const t=observedAt instanceof Date?observedAt.getTime():new Date(observedAt).getTime();
  const ref=now instanceof Date?now.getTime():Number(now);
  const threshold=Math.max(0,finite(staleAfterMs,'Stale threshold'));
  if(!Number.isFinite(t)||!Number.isFinite(ref))return {valid:false,stale:true,ageMs:null,label:'unknown'};
  const ageMs=Math.max(0,ref-t);
  if(ageMs>threshold)return {valid:true,stale:true,ageMs,label:'stale'};
  return {valid:true,stale:false,ageMs,label:'fresh'};
}

export function interpolateCalibration(points,target){
  if(!Array.isArray(points)||points.length<2)return null;
  const x=finite(target,'Calibration target');
  const normalized=points.map((p,index)=>({
    pct:finite(p?.pct,`Calibration point ${index+1} percent`),
    value:finite(p?.value??p?.ppfd,`Calibration point ${index+1} value`)
  })).sort((a,b)=>a.pct-b.pct);
  if(x<normalized[0].pct||x>normalized.at(-1).pct)return null;
  for(const p of normalized)if(x===p.pct)return p.value;
  for(let i=1;i<normalized.length;i++){
    const a=normalized[i-1],b=normalized[i];
    if(x>=a.pct&&x<=b.pct){
      const span=b.pct-a.pct;
      if(span<=0)return a.value;
      const f=(x-a.pct)/span;
      return a.value+(b.value-a.value)*f;
    }
  }
  return null;
}

export function normalizeMeasurementSource(input={}){
  const sourceType=String(input.sourceType??input.method??'manual').trim().toLowerCase()||'manual';
  const observedAt=String(input.observedAt??input.timestamp??'').trim();
  const calibrationDate=String(input.calibrationDate??input.checkedAt??'').trim();
  return {
    sourceType,
    sensorId:String(input.sensorId??input.sensorModel??'').trim().slice(0,160),
    method:String(input.method??sourceType).trim().slice(0,120),
    unit:String(input.unit??'').trim().slice(0,40),
    observedAt,
    calibrationDate,
    location:String(input.location??'').trim().slice(0,160),
    notes:String(input.notes??'').trim().slice(0,500)
  };
}

export function evaluateBandSeries(values,{low,high,sustainSamples=3,clearMargin=0}={}){
  const lo=finite(low,'Low band');
  const hi=finite(high,'High band');
  if(hi<=lo)throw new RangeError('High band must be greater than low band');
  const sustain=Math.max(1,Math.floor(finite(sustainSamples,'Sustain samples')));
  const margin=Math.max(0,finite(clearMargin,'Clear margin'));
  const clean=(Array.isArray(values)?values:[]).map((value,index)=>({
    value:finite(typeof value==='object'?value?.value:value,`Band sample ${index+1}`)
  }));
  let inBand=0,episodes=0,state='normal',pending=null,count=0;
  for(const row of clean){
    const v=row.value;
    if(v>=lo&&v<=hi)inBand++;
    const side=v<lo?'low':v>hi?'high':'normal';
    if(state==='normal'){
      if(side==='normal'){pending=null;count=0}
      else if(pending===side){
        count++;
        if(count>=sustain){state=side;episodes++;pending=null;count=0}
      }else{pending=side;count=1}
    }else{
      const clearLow=lo+margin,clearHigh=hi-margin;
      const cleared=state==='low'?v>=clearLow:v<=clearHigh;
      if(cleared){state='normal';pending=null;count=0}
    }
  }
  return {
    count:clean.length,
    inBandCount:inBand,
    inBandPercent:clean.length?inBand/clean.length*100:0,
    episodes,
    activeState:state
  };
}
