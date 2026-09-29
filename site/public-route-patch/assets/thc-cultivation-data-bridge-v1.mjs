import {createCultivationRecord} from './thc-cultivation-data-core-v1.mjs';

const TELEMETRY_MAP={
  temperatureC:'temperatureC',
  humidity:'humidityPercent',
  vpd:'vpdKpa',
  co2:'co2Ppm',
  ppfd:'ppfdUmolM2S',
  ec:'ecMsCm',
  ph:'ph',
  vwc:'vwcPercent',
  rootTemperatureC:'rootTemperatureC',
  leafTemperatureC:'leafTemperatureC',
  solutionTemperatureC:'solutionTemperatureC',
  dewPointC:'dewPointC',
  waterActivity:'waterActivity'
};

const telemetryType=metrics=>{
  const keys=new Set(Object.keys(metrics||{}));
  if(keys.has('ppfd'))return 'light';
  if(keys.has('ph')||keys.has('ec')||keys.has('solutionTemperatureC'))return 'solution';
  if(keys.has('vwc')||keys.has('rootTemperatureC'))return 'root-zone';
  if(keys.has('waterActivity'))return 'dry-cure';
  return 'environment';
};

export function telemetryPacketToCultivationRecord(packet={},context={}){
  const metrics={};
  for(const [source,target] of Object.entries(TELEMETRY_MAP)){
    if(packet?.metrics?.[source]!==undefined)metrics[target]=packet.metrics[source];
  }
  return createCultivationRecord({
    id:context.id,
    type:context.type??telemetryType(packet?.metrics),
    sourceType:'sensor',
    toolId:context.toolId??null,
    sourceId:packet?.sourceId??context.sourceId??null,
    plantId:context.plantId??null,
    cycleId:context.cycleId??null,
    spaceId:context.spaceId??null,
    zone:context.zone??packet?.zone??null,
    stage:context.stage??null,
    observedAt:packet?.observedAt??context.observedAt,
    metrics,
    values:context.values??{},
    tags:context.tags??[],
    provenance:{
      method:'telemetry',
      deviceModel:context.deviceModel??packet?.deviceId??null,
      calibrationId:context.calibrationId??null,
      estimated:false,
      derived:false
    }
  });
}

export function toolResultToCultivationRecord({
  toolId,
  type='tool-result',
  plantId=null,
  cycleId=null,
  spaceId=null,
  zone=null,
  stage=null,
  observedAt=new Date().toISOString(),
  metrics={},
  values={},
  tags=[],
  estimated=false
}={}){
  if(!toolId)throw new Error('toolId is required for a tool result.');
  return createCultivationRecord({
    type,
    sourceType:'tool',
    toolId,
    sourceId:toolId,
    plantId,
    cycleId,
    spaceId,
    zone,
    stage,
    observedAt,
    metrics,
    values,
    tags,
    provenance:{
      method:'tool-calculation',
      derived:true,
      estimated:Boolean(estimated)
    }
  });
}

export function manualMeasurementToCultivationRecord({
  type,
  toolId=null,
  plantId=null,
  cycleId=null,
  spaceId=null,
  zone=null,
  stage=null,
  observedAt=new Date().toISOString(),
  metrics={},
  values={},
  tags=[],
  method='manual-entry',
  deviceModel=null,
  calibrationId=null
}={}){
  return createCultivationRecord({
    type,
    sourceType:deviceModel?'meter':'manual',
    toolId,
    sourceId:deviceModel||'manual',
    plantId,
    cycleId,
    spaceId,
    zone,
    stage,
    observedAt,
    metrics,
    values,
    tags,
    provenance:{
      method,
      deviceModel,
      calibrationId,
      estimated:false,
      derived:false
    }
  });
}
