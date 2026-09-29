const hasValue=value=>value!==null&&value!==undefined&&!(typeof value==='string'&&!value.trim());

const numberOrNull=value=>{
  if(!hasValue(value)) return null;
  const n=Number(value);
  return Number.isFinite(n)?n:null;
};

const readPath=(input,path)=>{
  if(typeof path==='function') return path(input);
  if(!path) return undefined;
  return String(path).split('.').reduce((value,key)=>value?.[key],input);
};

const normalizeTime=value=>{
  if(!hasValue(value)) return null;
  const d=new Date(value);
  return Number.isFinite(d.getTime())?d.toISOString():null;
};

const defaultMetricAliases={
  temperatureC:['temperatureC','temperature','temp','airTemperatureC','airTempC','temperature.current'],
  humidity:['humidity','rh','relativeHumidity','humidity.current'],
  vpd:['vpd','vpdKpa','vpd_kpa','vpd.current'],
  co2:['co2','co2Ppm','co2_ppm','co2.current'],
  ppfd:['ppfd','par','ppfdUmol','ppfd.current','light.ppfd.current'],
  ec:['ec','ecMsCm','ec_ms_cm','ec.current','substrate.ec.current'],
  ph:['ph','pH'],
  vwc:['vwc','vwcPercent','substrateMoisturePercent','vwc.current','substrate.vwc.current','substrate.moisture.current'],
  rootTemperatureC:['rootTemperatureC','rootTempC','substrateTemperatureC','substrateTempC','substrate.temperature.current'],
  leafTemperatureC:['leafTemperatureC','leafTempC','leafTemperature','leafTemp'],
  solutionTemperatureC:['solutionTemperatureC','solutionTempC'],
  dewPointC:['dewPointC','dewPoint'],
  waterActivity:['waterActivity','aw','water_activity','productWaterActivity']
};

const firstValue=(input,paths)=>{
  for(const path of paths){
    const value=readPath(input,path);
    if(hasValue(value)) return value;
  }
  return undefined;
};

const canonicalMetricName=name=>{
  const key=String(name||'').toLowerCase().replace(/[^a-z0-9]+/g,'');
  if(!key)return null;
  if(key.includes('relativehumidity')||key==='humidity'||key==='rh')return 'humidity';
  if(key.includes('vpd'))return 'vpd';
  if(key.includes('co2')||key.includes('carbondioxide'))return 'co2';
  if(key.includes('ppfd')||key==='par'||key.includes('photosyntheticphoton'))return 'ppfd';
  if(key==='ph')return 'ph';
  if(key==='ec'||key.includes('electricalconductivity'))return 'ec';
  if(key==='vwc'||key.includes('volumetricwatercontent')||key.includes('substratemoisture'))return 'vwc';
  if(key.includes('dewpoint'))return 'dewPointC';
  if(key==='aw'||key.includes('wateractivity'))return 'waterActivity';
  if(key.includes('leaf')&&key.includes('temp'))return 'leafTemperatureC';
  if((key.includes('root')||key.includes('substrate'))&&key.includes('temp'))return 'rootTemperatureC';
  if(key.includes('solution')&&key.includes('temp'))return 'solutionTemperatureC';
  if(key.includes('temp'))return 'temperatureC';
  return null;
};

const convertStructuredValue=(metric,value,unit)=>{
  let n=numberOrNull(value);
  if(n===null)return null;
  const u=String(unit||'').trim().toLowerCase().replaceAll('°','');
  if(metric.endsWith('TemperatureC')||metric==='temperatureC'||metric==='dewPointC'){
    if(u==='f'||u.includes('fahrenheit'))n=(n-32)*5/9;
  }
  if(metric==='ec'&&(u.includes('µs')||u.includes('us/cm')||u.includes('microsiemens')))n/=1000;
  return n;
};

const structuredMetrics=source=>{
  const values=source?.dataPointDto?.dataPointValues;
  if(!Array.isArray(values))return {};
  const metrics={};
  for(const entry of values){
    const metric=canonicalMetricName(entry?.paramName);
    if(!metric)continue;
    const value=convertStructuredValue(metric,entry?.paramValue,entry?.measuringUnit);
    if(value!==null)metrics[metric]=value;
  }
  return metrics;
};

export function normalizeTelemetryPacket(input={},options={}){
  const source=input&&typeof input==='object'?input:{};
  const mapping=options.mapping&&typeof options.mapping==='object'?options.mapping:{};
  const observedRaw=options.observedAt
    ?? firstValue(source,[mapping.observedAt,'observedAt','createdAt','timestamp','time','at','dataPointDto.createdAt']);
  const observedAt=normalizeTime(observedRaw);
  const metrics=structuredMetrics(source);
  const keys=new Set([...Object.keys(defaultMetricAliases),...Object.keys(mapping).filter(key=>key!=='observedAt')]);
  for(const key of keys){
    const mapped=mapping[key];
    const aliases=mapped?[mapped]:defaultMetricAliases[key]||[key];
    let n=null;
    for(const alias of aliases){
      n=numberOrNull(readPath(source,alias));
      if(n!==null)break;
    }
    if(n!==null) metrics[key]=n;
  }
  return {
    sourceId:String(options.sourceId??source.sourceId??'manual').trim()||'manual',
    deviceId:String(options.deviceId??source.deviceId??source.sensorId??source.dataPointDto?.sensorId??'unspecified').trim()||'unspecified',
    zone:String(options.zone??source.zone??source.room??'').trim(),
    observedAt,
    receivedAt:normalizeTime(options.receivedAt) || new Date().toISOString(),
    metrics
  };
}

export function telemetryPacketKey(packet){
  const metricSignature=Object.entries(packet?.metrics||{}).sort(([a],[b])=>a.localeCompare(b)).map(([k,v])=>k+'='+v).join('|');
  return [packet?.sourceId||'',packet?.deviceId||'',packet?.observedAt||'',metricSignature].join('::');
}

export function appendTelemetryPacket(records,packet,{limit=500}={}){
  const list=Array.isArray(records)?records.slice():[];
  if(!packet||!packet.observedAt||!Object.keys(packet.metrics||{}).length) return list.slice(-Math.max(0,Number(limit)||0));
  const key=telemetryPacketKey(packet);
  const next=list.filter(row=>telemetryPacketKey(row)!==key);
  next.push(packet);
  next.sort((a,b)=>(Date.parse(a.observedAt)||0)-(Date.parse(b.observedAt)||0));
  return next.slice(-Math.max(0,Number(limit)||0));
}

export function telemetryFreshness(packet,{now=new Date(),staleAfterMs=5*60*1000}={}){
  const observed=Date.parse(packet?.observedAt);
  const nowMs=new Date(now).getTime();
  if(!Number.isFinite(observed)||!Number.isFinite(nowMs)) return {state:'unknown',ageMs:null,stale:null};
  const ageMs=Math.max(0,nowMs-observed);
  const stale=ageMs>Math.max(0,Number(staleAfterMs)||0);
  return {state:stale?'stale':'fresh',ageMs,stale};
}

export function connectionState({connected=false,lastSeenAt=null,now=new Date(),staleAfterMs=5*60*1000}={}){
  if(!connected&&!lastSeenAt) return {state:'offline',freshness:null};
  const freshness=telemetryFreshness({observedAt:lastSeenAt},{now,staleAfterMs});
  if(freshness.state==='unknown') return {state:connected?'connected':'offline',freshness};
  if(freshness.stale) return {state:'stale',freshness};
  return {state:connected?'live':'offline',freshness};
}

export function reconnectDelay(attempt,{baseMs=1000,maxMs=30000}={}){
  const a=Math.max(0,Math.floor(Number(attempt)||0));
  const base=Math.max(1,Number(baseMs)||1000);
  const max=Math.max(base,Number(maxMs)||30000);
  return Math.min(max,base*(2**a));
}

export function buildMetricSeries(records,metricKeys=[]){
  const keys=[...new Set(metricKeys.map(String))];
  const rows=(Array.isArray(records)?records:[])
    .filter(row=>Number.isFinite(Date.parse(row?.observedAt)))
    .slice()
    .sort((a,b)=>Date.parse(a.observedAt)-Date.parse(b.observedAt));
  const timestamps=rows.map(row=>Date.parse(row.observedAt)/1000);
  const values=Object.fromEntries(keys.map(key=>[key,rows.map(row=>{
    const value=numberOrNull(row?.metrics?.[key]);
    return value===null?null:value;
  })]));
  return {metricKeys:keys,timestamps,values};
}

const TOOL_FIELD_MAPS={
  environment:{temperatureC:'et',humidity:'erh',leafTemperatureC:'leaf',rootTemperatureC:'root',ppfd:'ppfd'},
  vpd:{temperatureC:'temp',humidity:'rh'},
  'root-zone':{rootTemperatureC:'rzt',temperatureC:'rat',solutionTemperatureC:'solutionT',ec:'measuredRootEc'},
  dryback:{ec:'rootEc',vwc:'current'},
  ph:{ph:'ph'},
  tds:{ec:'ec'},
  ppfd:{ppfd:'ppfd'},
  'dry-cure':{temperatureC:'dt',humidity:'drh',waterActivity:'aw'}
};

export function packetToToolFields(packet,tool){
  const map=TOOL_FIELD_MAPS[tool]||{};
  const out={};
  for(const [metric,field] of Object.entries(map)){
    const value=numberOrNull(packet?.metrics?.[metric]);
    if(value!==null) out[field]=value;
  }
  if(tool==='vpd'){
    const air=numberOrNull(packet?.metrics?.temperatureC);
    const leaf=numberOrNull(packet?.metrics?.leafTemperatureC);
    if(air!==null&&leaf!==null)out.offset=leaf-air;
  }
  return out;
}


const validateTransportUrl=(value,protocols,label)=>{
  let parsed;
  try{parsed=new URL(String(value||''))}catch{throw new Error(label+' URL must be valid.')}
  if(!protocols.includes(parsed.protocol))throw new Error(label+' URL must use '+protocols.join(' or ')+'.');
  return parsed.toString();
};

export function createRestPollingAdapter({
  url,
  fetchFn=globalThis.fetch?.bind(globalThis),
  intervalMs=10000,
  requestInit={},
  normalizeOptions={},
  onPacket=()=>{},
  onError=()=>{},
  setIntervalFn=globalThis.setInterval?.bind(globalThis),
  clearIntervalFn=globalThis.clearInterval?.bind(globalThis)
}={}){
  const endpoint=validateTransportUrl(url,['http:','https:'],'HTTP');
  if(typeof fetchFn!=='function')throw new Error('HTTP polling requires fetch.');
  let timer=null,connected=false,lastSeenAt=null,lastPacket=null;

  const pollOnce=async()=>{
    try{
      const {method:_method,body:_body,...safeRequestInit}=requestInit||{};
      const response=await fetchFn(endpoint,{...safeRequestInit,method:'GET'});
      if(!response?.ok)throw new Error('HTTP telemetry request failed with status '+(response?.status??'unknown')+'.');
      let payload=await response.json();
      if(Array.isArray(payload))payload=payload.at(-1);
      const packet=normalizeTelemetryPacket(payload||{},{...normalizeOptions,receivedAt:new Date().toISOString()});
      if(!Object.keys(packet.metrics).length)throw new Error('HTTP telemetry response contained no recognized numeric metrics.');
      connected=true;
      lastSeenAt=new Date().toISOString();
      lastPacket=packet;
      onPacket(packet);
      return packet;
    }catch(error){
      connected=false;
      onError(error);
      throw error;
    }
  };

  const start=()=>{
    if(timer!==null)return;
    void pollOnce().catch(()=>{});
    if(typeof setIntervalFn==='function')timer=setIntervalFn(()=>{void pollOnce().catch(()=>{})},Math.max(1000,Number(intervalMs)||10000));
  };
  const stop=()=>{
    if(timer!==null&&typeof clearIntervalFn==='function')clearIntervalFn(timer);
    timer=null;
    connected=false;
  };
  const getState=()=>({...connectionState({connected,lastSeenAt,staleAfterMs:Math.max(3000,(Number(intervalMs)||10000)*3)}),lastSeenAt,lastPacket});

  return {pollOnce,start,stop,getState,url:endpoint};
}

export function createWebSocketAdapter({
  url,
  WebSocketImpl=globalThis.WebSocket,
  normalizeOptions={},
  onPacket=()=>{},
  onError=()=>{},
  onState=()=>{},
  reconnect=true,
  baseReconnectMs=1000,
  maxReconnectMs=30000,
  setTimeoutFn=globalThis.setTimeout?.bind(globalThis),
  clearTimeoutFn=globalThis.clearTimeout?.bind(globalThis)
}={}){
  const endpoint=validateTransportUrl(url,['ws:','wss:'],'WebSocket');
  if(typeof WebSocketImpl!=='function')throw new Error('WebSocket transport requires a WebSocket implementation.');
  let socket=null,reconnectTimer=null,attempt=0,manualClose=false,connected=false,lastSeenAt=null,lastPacket=null;

  const emitState=()=>onState(getState());

  const scheduleReconnect=()=>{
    if(!reconnect||manualClose||typeof setTimeoutFn!=='function')return;
    const delay=reconnectDelay(attempt,{baseMs:baseReconnectMs,maxMs:maxReconnectMs});
    attempt++;
    reconnectTimer=setTimeoutFn(()=>{reconnectTimer=null;connect()},delay);
  };

  const connect=()=>{
    manualClose=false;
    if(reconnectTimer!==null&&typeof clearTimeoutFn==='function'){clearTimeoutFn(reconnectTimer);reconnectTimer=null}
    socket=new WebSocketImpl(endpoint);
    socket.onopen=()=>{connected=true;attempt=0;emitState()};
    socket.onmessage=event=>{
      try{
        let payload=typeof event?.data==='string'?JSON.parse(event.data):event?.data;
        if(Array.isArray(payload))payload=payload.at(-1);
        const packet=normalizeTelemetryPacket(payload||{},{...normalizeOptions,receivedAt:new Date().toISOString()});
        if(!Object.keys(packet.metrics).length)throw new Error('WebSocket telemetry message contained no recognized numeric metrics.');
        connected=true;
        lastSeenAt=new Date().toISOString();
        lastPacket=packet;
        onPacket(packet);
        emitState();
      }catch(error){onError(error)}
    };
    socket.onerror=event=>onError(event instanceof Error?event:new Error('WebSocket telemetry error.'));
    socket.onclose=()=>{connected=false;emitState();scheduleReconnect()};
    return socket;
  };

  const close=()=>{
    manualClose=true;
    if(reconnectTimer!==null&&typeof clearTimeoutFn==='function'){clearTimeoutFn(reconnectTimer);reconnectTimer=null}
    connected=false;
    if(socket&&typeof socket.close==='function')socket.close();
    emitState();
  };

  function getState(){return {...connectionState({connected,lastSeenAt,staleAfterMs:5*60*1000}),lastSeenAt,lastPacket,attempt}}

  return {connect,close,getState,url:endpoint};
}
