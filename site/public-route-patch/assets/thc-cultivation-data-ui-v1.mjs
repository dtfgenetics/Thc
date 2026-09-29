import {collectCultivationRecord,loadCultivationData} from './thc-cultivation-data-store-v1.mjs';
import {
  manualMeasurementToCultivationRecord,
  telemetryPacketToCultivationRecord,
  toolResultToCultivationRecord
} from './thc-cultivation-data-bridge-v1.mjs';

function resolvedContext(thc=globalThis.window?.THC){
  const context=thc?.context?.get?.()||{};
  const growlens=thc?.growlens?.resolve?.()||{};
  return {
    plantId:growlens.plantId||null,
    cycleId:growlens.cycleId||null,
    spaceId:growlens.spaceId||null,
    zone:String(context.zone||'').trim()||null,
    stage:String(context.stage||'').trim()||null,
    cultivar:String(context.cultivar||'').trim()||null
  };
}

function valuesWithContext(values,context){
  return {
    ...(values&&typeof values==='object'?values:{}),
    ...(context.cultivar?{cultivar:context.cultivar}:{})
  };
}

export function collectManualCultivationMeasurement(input={},options={}){
  const context=resolvedContext(options.thc);
  const record=manualMeasurementToCultivationRecord({
    ...input,
    plantId:input.plantId??context.plantId,
    cycleId:input.cycleId??context.cycleId,
    spaceId:input.spaceId??context.spaceId,
    zone:input.zone??context.zone,
    stage:input.stage??context.stage,
    values:valuesWithContext(input.values,context)
  });
  const records=collectCultivationRecord(record,options);
  return {record,count:records.length};
}

export function collectCultivationToolResult(input={},options={}){
  const context=resolvedContext(options.thc);
  const record=toolResultToCultivationRecord({
    ...input,
    plantId:input.plantId??context.plantId,
    cycleId:input.cycleId??context.cycleId,
    spaceId:input.spaceId??context.spaceId,
    zone:input.zone??context.zone,
    stage:input.stage??context.stage,
    values:valuesWithContext(input.values,context)
  });
  const records=collectCultivationRecord(record,options);
  return {record,count:records.length};
}

export function collectTelemetryCultivationPacket(packet,contextInput={},options={}){
  const context=resolvedContext(options.thc);
  const record=telemetryPacketToCultivationRecord(packet,{
    ...contextInput,
    plantId:contextInput.plantId??context.plantId,
    cycleId:contextInput.cycleId??context.cycleId,
    spaceId:contextInput.spaceId??context.spaceId,
    zone:contextInput.zone??context.zone??packet?.zone??null,
    stage:contextInput.stage??context.stage,
    values:valuesWithContext(contextInput.values,context)
  });
  const records=collectCultivationRecord(record,options);
  return {record,count:records.length};
}

export function cultivationDataCount(options={}){
  return loadCultivationData(options).length;
}
