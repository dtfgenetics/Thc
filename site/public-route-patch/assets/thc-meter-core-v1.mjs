import {normalizeMeasurementSource,readingFreshness} from './thc-measurement-core-v1.mjs';

const finite=(value,label)=>{const n=Number(value);if(!Number.isFinite(n))throw new RangeError(`${label} must be a finite number`);return n};

function signedAgeDays(dateValue,now=new Date()){
  const raw=String(dateValue??'').trim();
  if(!/^\d{4}-\d{2}-\d{2}$/.test(raw))return null;
  const at=new Date(raw+'T12:00:00Z');
  const ref=now instanceof Date?now:new Date(now);
  if(Number.isNaN(at.getTime())||Number.isNaN(ref.getTime()))return null;
  return Math.floor((ref.getTime()-at.getTime())/86400000);
}

export function calibrationState(dateValue,{now=new Date()}={}){
  const ageDays=signedAgeDays(dateValue,now);
  if(ageDays===null)return {status:'unknown',ageDays:null};
  if(ageDays<0)return {status:'future',ageDays};
  return {status:'recorded',ageDays};
}

export function validatePh(value){
  const n=finite(value,'pH');
  if(n<0||n>14)throw new RangeError('pH must be between 0 and 14');
  return n;
}

export function validateEc(value){
  const n=finite(value,'EC');
  if(n<0||n>20)throw new RangeError('EC must be between 0 and 20 mS/cm');
  return n;
}

export function normalizeMeterRecord(input={}){
  const tempRaw=input.tempC;
  let tempC='';
  if(tempRaw!==''&&tempRaw!==null&&tempRaw!==undefined){
    const n=finite(tempRaw,'Sample temperature');
    if(n<0||n>60)throw new RangeError('Sample temperature must be between 0 and 60 °C');
    tempC=Number(n.toFixed(1));
  }
  return {
    meter:String(input.meter??input.sensorId??'').trim().slice(0,80),
    calibration:String(input.calibration??input.calibrationDate??'').trim().slice(0,20),
    calibrationRefs:String(input.calibrationRefs??input.calibrationStandard??'').trim().slice(0,80),
    tempC,
    notes:String(input.notes??'').trim().slice(0,180)
  };
}

export function measurementSource(input={},options={}){
  const source=normalizeMeasurementSource(input);
  return {
    ...source,
    freshness:readingFreshness(source.observedAt,options),
    calibration:calibrationState(source.calibrationDate,{now:options.now??new Date()})
  };
}
