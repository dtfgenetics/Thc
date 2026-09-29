const finite=value=>{if(value===null||value===undefined||(typeof value==='string'&&!value.trim()))return NaN;const n=Number(value);return Number.isFinite(n)?n:NaN};
const timeValue=(row,key)=>{const raw=typeof key==='function'?key(row):row?.[key];const t=raw instanceof Date?raw.getTime():new Date(raw).getTime();return Number.isFinite(t)?t:NaN};

export function buildTimeSeriesData(rows,{dateKey='at',series=[]}={}){
  const defs=Array.isArray(series)?series:[];
  const normalized=(Array.isArray(rows)?rows:[]).map(row=>{
    const time=timeValue(row,dateKey);
    const values=defs.map(def=>{
      const raw=typeof def.value==='function'?def.value(row):row?.[def.key];
      return finite(raw);
    });
    return {row,time,values};
  }).filter(item=>Number.isFinite(item.time)&&item.values.some(Number.isFinite)).sort((a,b)=>a.time-b.time);
  return {
    rows:normalized.map(item=>item.row),
    timestamps:normalized.map(item=>item.time/1000),
    series:defs.map((_,index)=>normalized.map(item=>Number.isFinite(item.values[index])?item.values[index]:null))
  };
}

export function renderTimeSeriesChart(container,rows,{
  dateKey='at',
  series=[],
  height=280,
  yLabel='',
  emptyText='Save at least two readings to draw a trend.',
  fallbackContainer=null,
  fallbackColumns=[]
}={}){
  if(!container)throw new Error('Time-series chart container is required.');
  const data=buildTimeSeriesData(rows,{dateKey,series});
  if(container.__thcUplot){container.__thcUplot.destroy();container.__thcUplot=null}
  container.replaceChildren();
  if(data.timestamps.length<2||!globalThis.uPlot){
    const p=document.createElement('p');
    p.className='muted';
    p.textContent=data.timestamps.length<2?emptyText:'Chart rendering is unavailable; the saved data is still available below.';
    container.append(p);
    renderFallback(fallbackContainer,data.rows,fallbackColumns);
    return {chart:null,data};
  }
  if(fallbackContainer){fallbackContainer.replaceChildren();fallbackContainer.hidden=true;fallbackContainer.style.display='none'}
  const opts={
    width:Math.max(320,container.clientWidth||640),
    height,
    scales:{x:{time:true},y:{auto:true}},
    series:[{},...series.map(def=>({
      label:def.label||def.key||'Value',
      stroke:def.stroke,
      width:def.width??2,
      dash:def.dash,
      points:def.points
    }))],
    axes:[{},yLabel?{label:yLabel}:{}],
    cursor:{drag:{x:true,y:false,setScale:true}}
  };
  const chart=new globalThis.uPlot(opts,[data.timestamps,...data.series],container);
  container.__thcUplot=chart;
  return {chart,data};
}

export function renderFallback(container,rows,columns=[]){
  if(!container)return;
  container.replaceChildren();
  if(!rows.length||!columns.length){container.hidden=true;container.style.display='none';return}
  const table=document.createElement('table'),thead=document.createElement('thead'),headRow=document.createElement('tr'),tbody=document.createElement('tbody');
  for(const col of columns){const th=document.createElement('th');th.textContent=col.label||col.key||'';headRow.append(th)}
  thead.append(headRow);
  for(const row of rows){
    const tr=document.createElement('tr');
    for(const col of columns){
      const td=document.createElement('td'),raw=typeof col.value==='function'?col.value(row):row?.[col.key];
      td.textContent=col.format?String(col.format(raw,row)):String(raw??'—');
      tr.append(td);
    }
    tbody.append(tr);
  }
  table.append(thead,tbody);
  container.append(table);
  container.hidden=false;
  container.style.display='block';
}
