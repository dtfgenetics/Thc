const hasValue=value=>value!==null&&value!==undefined&&!(typeof value==='string'&&!value.trim());
export function numericValue(value){if(!hasValue(value))return null;const n=Number(value);return Number.isFinite(n)?n:null}

export function filterRecords(records,filters={}){
  const list=Array.isArray(records)?records:[];
  const active=Object.entries(filters).filter(([,value])=>hasValue(value));
  if(!active.length)return list.slice();
  return list.filter(record=>active.every(([key,value])=>record?.[key]===value));
}

export function uniqueFieldValues(records,key){
  return [...new Set((Array.isArray(records)?records:[])
    .map(record=>record?.[key])
    .filter(hasValue)
    .map(value=>String(value).trim())
    .filter(Boolean))].sort((a,b)=>a.localeCompare(b));
}

export function latestByGroup(records,groupKey,dateKey='at'){
  const map=new Map();
  for(const row of Array.isArray(records)?records:[]){
    const rawKey=row?.[groupKey];
    if(!hasValue(rawKey))continue;
    const time=new Date(row?.[dateKey]).getTime();
    if(!Number.isFinite(time))continue;
    const key=String(rawKey).trim();
    const prev=map.get(key);
    if(!prev||time>prev.time)map.set(key,{row,time});
  }
  return [...map.entries()]
    .map(([key,{row}])=>({key,row}))
    .sort((a,b)=>a.key.localeCompare(b.key));
}

export function numericSpread(records,key){
  const values=(Array.isArray(records)?records:[])
    .map(row=>numericValue(row?.[key]))
    .filter(Number.isFinite);
  if(!values.length)return null;
  if(values.length===1)return 0;
  return Math.max(...values)-Math.min(...values);
}

export function csvRow(values){
  return (Array.isArray(values)?values:[]).map(value=>{
    const text=value===null||value===undefined?'':String(value);
    return '"'+text.replaceAll('"','""')+'"';
  }).join(',');
}

export function csvTable(header,records,mapper){
  const rows=[csvRow(header)];
  for(const record of Array.isArray(records)?records:[])rows.push(csvRow(mapper(record)));
  return rows;
}

export function sanitizeHistory(records,{limit=500,validator=()=>true,normalize=value=>value}={}){
  const clean=[];
  for(const record of Array.isArray(records)?records:[]){
    if(!validator(record))continue;
    const normalized=normalize(record);
    if(normalized!==null&&normalized!==undefined)clean.push(normalized);
  }
  return clean.slice(-Math.max(0,Number(limit)||0));
}
