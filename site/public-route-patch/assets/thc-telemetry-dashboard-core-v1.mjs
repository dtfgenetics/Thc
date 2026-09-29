const hasValue=value=>value!==null&&value!==undefined&&!(typeof value==='string'&&!value.trim());
const finite=value=>{if(!hasValue(value))return null;const n=Number(value);return Number.isFinite(n)?n:null};
const packetKey=packet=>[packet?.sourceId||'',packet?.deviceId||''].join('::');

const freshness=(packet,{now=new Date(),staleAfterMs=5*60*1000}={})=>{
  const at=Date.parse(packet?.observedAt);
  const nowMs=new Date(now).getTime();
  if(!Number.isFinite(at)||!Number.isFinite(nowMs))return {state:'unknown',ageMs:null};
  const ageMs=Math.max(0,nowMs-at);
  return {state:ageMs>Math.max(0,Number(staleAfterMs)||0)?'stale':'fresh',ageMs};
};

export function latestDevicePackets(records,options={}){
  const latest=new Map();
  for(const packet of Array.isArray(records)?records:[]){
    const key=packetKey(packet);
    if(key==='::')continue;
    const at=Date.parse(packet?.observedAt);
    if(!Number.isFinite(at))continue;
    const previous=latest.get(key);
    if(!previous||at>previous.at)latest.set(key,{packet,at});
  }
  return [...latest.values()]
    .map(({packet})=>({
      sourceId:String(packet?.sourceId||''),
      deviceId:String(packet?.deviceId||'Unspecified'),
      zone:String(packet?.zone||'').trim()||'Unspecified',
      packet,
      ...freshness(packet,options)
    }))
    .sort((a,b)=>a.zone.localeCompare(b.zone)||a.deviceId.localeCompare(b.deviceId)||a.sourceId.localeCompare(b.sourceId));
}

export function telemetryHealthSummary(records,options={}){
  const latest=latestDevicePackets(records,options);
  const summary={devices:latest.length,fresh:0,stale:0,unknown:0,zones:new Set(latest.map(x=>x.zone)).size};
  for(const item of latest)summary[item.state]=(summary[item.state]||0)+1;
  return summary;
}

export function zoneTelemetrySummary(records,options={}){
  const groups=new Map();
  for(const item of latestDevicePackets(records,options)){
    const current=groups.get(item.zone)||{zone:item.zone,devices:0,fresh:0,stale:0,unknown:0};
    current.devices++;
    current[item.state]=(current[item.state]||0)+1;
    groups.set(item.zone,current);
  }
  return [...groups.values()].sort((a,b)=>a.zone.localeCompare(b.zone));
}

export function telemetryMetricCoverage(records){
  const latest=latestDevicePackets(records);
  const counts=new Map();
  for(const item of latest){
    for(const [metric,value] of Object.entries(item.packet?.metrics||{})){
      if(finite(value)===null)continue;
      counts.set(metric,(counts.get(metric)||0)+1);
    }
  }
  return [...counts.entries()]
    .map(([metric,devices])=>({metric,devices}))
    .sort((a,b)=>a.metric.localeCompare(b.metric));
}

export function telemetryTableModel(records,{metricKeys=[], ...options}={}){
  const latest=latestDevicePackets(records,options);
  const keys=[...new Set(metricKeys.map(String))];
  const rows=latest.map(item=>{
    const row={
      deviceId:item.deviceId,
      sourceId:item.sourceId,
      zone:item.zone,
      state:item.state,
      observedAt:item.packet?.observedAt||null
    };
    for(const key of keys)row[key]=finite(item.packet?.metrics?.[key]);
    return row;
  });
  return {
    columns:['deviceId','sourceId','zone','state','observedAt',...keys],
    rows
  };
}
