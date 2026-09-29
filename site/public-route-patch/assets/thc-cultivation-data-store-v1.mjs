import {
  appendCultivationRecord,
  validateCultivationRecord
} from './thc-cultivation-data-core-v1.mjs';

export const CULTIVATION_DATA_STORAGE_KEY='thc-cultivation-data-v1';

const storageOrNull=storage=>{
  if(storage)return storage;
  try{return globalThis.localStorage??null}catch{return null}
};

export function loadCultivationData({storage=null,key=CULTIVATION_DATA_STORAGE_KEY}={}){
  const target=storageOrNull(storage);
  if(!target?.getItem)return [];
  try{
    const raw=target.getItem(key);
    if(!raw)return [];
    const parsed=JSON.parse(raw);
    const records=Array.isArray(parsed)?parsed:Array.isArray(parsed?.records)?parsed.records:[];
    return records.filter(record=>validateCultivationRecord(record).length===0);
  }catch{return []}
}

export function saveCultivationData(records,{storage=null,key=CULTIVATION_DATA_STORAGE_KEY,limit=5000}={}){
  const target=storageOrNull(storage);
  if(!target?.setItem)throw new Error('Cultivation data storage is unavailable.');
  const clean=(Array.isArray(records)?records:[])
    .filter(record=>validateCultivationRecord(record).length===0)
    .slice(-Math.max(1,Number(limit)||5000));
  target.setItem(key,JSON.stringify({
    schema:'thc-cultivation-data-store',
    version:1,
    savedAt:new Date().toISOString(),
    records:clean
  }));
  return clean;
}

export function collectCultivationRecord(record,options={}){
  const current=loadCultivationData(options);
  const next=appendCultivationRecord(current,record,{limit:options.limit??5000});
  saveCultivationData(next,options);
  return next;
}

export function exportCultivationData(records,{generatedAt=new Date().toISOString()}={}){
  const clean=(Array.isArray(records)?records:[])
    .filter(record=>validateCultivationRecord(record).length===0);
  return JSON.stringify({
    schema:'thc-cultivation-data-export',
    version:1,
    generatedAt,
    recordCount:clean.length,
    records:clean
  },null,2);
}

export function importCultivationData(raw,{existing=[],limit=5000}={}){
  const parsed=typeof raw==='string'?JSON.parse(raw):raw;
  const incoming=Array.isArray(parsed)?parsed:parsed?.records;
  if(!Array.isArray(incoming))throw new Error('Cultivation data import must contain a records array.');
  let next=Array.isArray(existing)?existing.slice():[];
  for(const record of incoming){
    if(validateCultivationRecord(record).length)continue;
    next=appendCultivationRecord(next,record,{limit});
  }
  return next;
}

export function clearCultivationData({storage=null,key=CULTIVATION_DATA_STORAGE_KEY}={}){
  const target=storageOrNull(storage);
  if(target?.removeItem)target.removeItem(key);
}
