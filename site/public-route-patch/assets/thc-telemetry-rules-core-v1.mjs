const hasValue=value=>value!==null&&value!==undefined&&!(typeof value==='string'&&!value.trim());
const finite=value=>{if(!hasValue(value))return null;const n=Number(value);return Number.isFinite(n)?n:null};
const iso=value=>{if(!hasValue(value))return null;const d=new Date(value);return Number.isFinite(d.getTime())?d.toISOString():null};

export function normalizeTelemetryRule(input={}){
  const id=String(input.id??'').trim();
  const metric=String(input.metric??'').trim();
  if(!id)throw new Error('Telemetry rule requires an id.');
  if(!metric)throw new Error('Telemetry rule requires a metric.');
  const low=finite(input.low),high=finite(input.high);
  if(low===null&&high===null)throw new Error('Telemetry rule requires a low or high threshold.');
  if(low!==null&&high!==null&&low>=high)throw new Error('Telemetry rule low threshold must be below high threshold.');
  return {
    id,
    metric,
    low,
    high,
    sustainSamples:Math.max(1,Math.floor(finite(input.sustainSamples)??1)),
    clearMargin:Math.max(0,finite(input.clearMargin)??0),
    enabled:input.enabled!==false,
    deviceId:String(input.deviceId??'').trim(),
    zone:String(input.zone??'').trim()
  };
}

const directionFor=(value,rule)=>{
  if(value===null)return null;
  if(rule.low!==null&&value<rule.low)return 'low';
  if(rule.high!==null&&value>rule.high)return 'high';
  return 'normal';
};

const validRows=(records,rule)=>(Array.isArray(records)?records:[])
  .filter(row=>{
    if(rule.deviceId&&String(row?.deviceId??'')!==rule.deviceId)return false;
    if(rule.zone&&String(row?.zone??'')!==rule.zone)return false;
    if(!Number.isFinite(Date.parse(row?.observedAt)))return false;
    return finite(row?.metrics?.[rule.metric])!==null;
  })
  .slice()
  .sort((a,b)=>Date.parse(a.observedAt)-Date.parse(b.observedAt));

export function evaluateTelemetryRule(records,inputRule,{previousState=null}={}){
  const rule=normalizeTelemetryRule(inputRule);
  if(!rule.enabled)return {ruleId:rule.id,state:'disabled',direction:null,value:null,count:0,observedAt:null};
  const rows=validRows(records,rule);
  if(!rows.length)return {ruleId:rule.id,state:'unknown',direction:null,value:null,count:0,observedAt:null};
  const latest=rows.at(-1);
  const value=finite(latest.metrics?.[rule.metric]);
  let direction=directionFor(value,rule);

  if(previousState?.state==='active'&&previousState?.direction==='high'&&rule.high!==null){
    if(value>rule.high-rule.clearMargin)direction='high';
  }
  if(previousState?.state==='active'&&previousState?.direction==='low'&&rule.low!==null){
    if(value<rule.low+rule.clearMargin)direction='low';
  }

  if(direction==='normal'){
    return {ruleId:rule.id,state:'normal',direction:null,value,count:0,observedAt:latest.observedAt};
  }

  let count=0;
  for(let i=rows.length-1;i>=0;i--){
    const rowValue=finite(rows[i]?.metrics?.[rule.metric]);
    if(directionFor(rowValue,rule)===direction)count++;
    else break;
  }

  const heldActive=previousState?.state==='active'&&previousState?.direction===direction;
  const state=heldActive||count>=rule.sustainSamples?'active':'pending';
  return {ruleId:rule.id,state,direction,value,count,observedAt:latest.observedAt};
}

export function evaluateTelemetryRules(records,rules,{previousStates={}}={}){
  return (Array.isArray(rules)?rules:[]).map(rule=>{
    const normalized=normalizeTelemetryRule(rule);
    const previousState=previousStates?.[normalized.id]??null;
    return evaluateTelemetryRule(records,normalized,{previousState});
  });
}

export function calibrationHealth({lastCalibrationAt=null,maxAgeDays=30,now=new Date()}={}){
  const max=Math.max(1,finite(maxAgeDays)??30);
  const at=Date.parse(lastCalibrationAt);
  const nowMs=new Date(now).getTime();
  if(!Number.isFinite(at)||!Number.isFinite(nowMs))return {state:'unknown',ageDays:null,maxAgeDays:max};
  const ageDays=Math.max(0,(nowMs-at)/86400000);
  const state=ageDays>max?'expired':ageDays>=max*0.8?'due':'fresh';
  return {state,ageDays,maxAgeDays:max};
}

export function normalizeDeviceHealth(input={}){
  const thresholds=(Array.isArray(input.thresholds)?input.thresholds:[]).map(item=>({
    metric:String(item?.metric??'').trim(),
    low:finite(item?.low),
    high:finite(item?.high),
    delayMinutes:Math.max(0,finite(item?.delayMinutes)??0),
    enabled:item?.enabled!==false
  })).filter(item=>item.metric&&(item.low!==null||item.high!==null));
  const calibrations={};
  for(const [key,value] of Object.entries(input.calibrations&&typeof input.calibrations==='object'?input.calibrations:{})){
    calibrations[key]=iso(value);
  }
  return {
    id:String(input.id??'').trim(),
    name:String(input.name??'').trim(),
    zone:String(input.zone??'').trim(),
    thresholds,
    calibrations
  };
}
