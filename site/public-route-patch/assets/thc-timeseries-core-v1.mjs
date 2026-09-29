import {evaluateBandSeries,readingFreshness} from './thc-measurement-core-v1.mjs';

const valueAt=(row,key)=>{const raw=typeof key==='function'?key(row):row?.[key];if(raw===null||raw===undefined||(typeof raw==='string'&&!raw.trim()))return NaN;return Number(raw)};
const dateAt=(row,key)=>{const raw=row?.[key];if(raw===null||raw===undefined||(typeof raw==='string'&&!raw.trim()))return NaN;return new Date(raw).getTime()};

export function numericSummary(rows,key){
  const values=(Array.isArray(rows)?rows:[]).map(row=>valueAt(row,key)).filter(Number.isFinite);
  if(!values.length)return {count:0,min:null,max:null,avg:null};
  return {
    count:values.length,
    min:Math.min(...values),
    max:Math.max(...values),
    avg:values.reduce((sum,value)=>sum+value,0)/values.length
  };
}

export function filterTimeWindow(rows,{from=null,to=null,dateKey='at'}={}){
  const start=from==null?null:new Date(from).getTime();
  const end=to==null?null:new Date(to).getTime();
  return (Array.isArray(rows)?rows:[]).filter(row=>{
    const t=dateAt(row,dateKey);
    if(!Number.isFinite(t))return false;
    if(Number.isFinite(start)&&t<start)return false;
    if(Number.isFinite(end)&&t>end)return false;
    return true;
  });
}

export function latestObservation(rows,{dateKey='at',now=Date.now(),staleAfterMs=15*60*1000}={}){
  const valid=(Array.isArray(rows)?rows:[]).map(row=>({row,time:dateAt(row,dateKey)})).filter(item=>Number.isFinite(item.time)).sort((a,b)=>b.time-a.time);
  if(!valid.length)return {row:null,freshness:{valid:false,stale:true,ageMs:null,label:'unknown'}};
  const latest=valid[0];
  return {row:latest.row,freshness:readingFreshness(new Date(latest.time),{now,staleAfterMs})};
}

export function groupSummary(rows,groupKey,valueKey){
  const groups={};
  for(const row of Array.isArray(rows)?rows:[]){
    const key=String(row?.[groupKey]??'').trim();
    if(!key)continue;
    (groups[key]??=[]).push(row);
  }
  return Object.fromEntries(Object.entries(groups).map(([key,items])=>[key,numericSummary(items,valueKey)]));
}

export function bandSummary(rows,valueKey,options){
  const values=(Array.isArray(rows)?rows:[]).map(row=>valueAt(row,valueKey)).filter(Number.isFinite);
  return evaluateBandSeries(values,options);
}


export function medianValue(rows,key){
  const values=(Array.isArray(rows)?rows:[]).map(row=>valueAt(row,key)).filter(Number.isFinite).sort((a,b)=>a-b);
  if(!values.length)return null;
  const mid=Math.floor(values.length/2);
  return values.length%2?values[mid]:(values[mid-1]+values[mid])/2;
}

export function timeSeriesStats(rows,{dateKey='at',valueKey='value'}={}){
  const valid=(Array.isArray(rows)?rows:[])
    .map(row=>({row,time:dateAt(row,dateKey),value:valueAt(row,valueKey)}))
    .filter(item=>Number.isFinite(item.time)&&Number.isFinite(item.value))
    .sort((a,b)=>a.time-b.time);
  if(!valid.length)return {count:0,min:null,max:null,avg:null,median:null,start:null,end:null,durationMs:0};
  const values=valid.map(item=>item.value);
  const mid=Math.floor(values.length/2),sorted=values.slice().sort((a,b)=>a-b);
  return {
    count:values.length,
    min:Math.min(...values),
    max:Math.max(...values),
    avg:values.reduce((sum,value)=>sum+value,0)/values.length,
    median:sorted.length%2?sorted[mid]:(sorted[mid-1]+sorted[mid])/2,
    start:new Date(valid[0].time).toISOString(),
    end:new Date(valid.at(-1).time).toISOString(),
    durationMs:Math.max(0,valid.at(-1).time-valid[0].time)
  };
}

export function integrateTimeSeries(rows,{dateKey='at',valueKey='value',scale=1,maxGapMs=Infinity}={}){
  const valid=(Array.isArray(rows)?rows:[])
    .map(row=>({time:dateAt(row,dateKey),value:valueAt(row,valueKey)}))
    .filter(item=>Number.isFinite(item.time)&&Number.isFinite(item.value))
    .sort((a,b)=>a.time-b.time);
  let total=0,durationMs=0,segments=0,maxObservedGapMs=0;
  for(let i=1;i<valid.length;i++){
    const dt=valid[i].time-valid[i-1].time;
    if(!(dt>0))continue;
    maxObservedGapMs=Math.max(maxObservedGapMs,dt);
    if(dt>maxGapMs)continue;
    total+=((valid[i-1].value+valid[i].value)/2)*(dt/1000)*scale;
    durationMs+=dt;
    segments++;
  }
  return {value:total,durationMs,segments,maxObservedGapMs};
}
