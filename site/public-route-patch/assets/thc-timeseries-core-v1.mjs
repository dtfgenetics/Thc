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
