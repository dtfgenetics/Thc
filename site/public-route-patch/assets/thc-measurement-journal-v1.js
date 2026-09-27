(()=>{'use strict';
const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const q=id=>document.getElementById(id);
const asCsv=v=>{const s=String(v??'');return /[",\n]/.test(s)?'"'+s.replace(/"/g,'""')+'"':s};
const safeJson=(raw,fallback)=>{try{const v=JSON.parse(raw);return Array.isArray(v)?v:fallback}catch{return fallback}};
function create(config){
 const key=config.storageKey;
 const limit=Math.max(25,Number(config.limit)||250);
 let rows=safeJson(localStorage.getItem(key),[]).map(config.normalizeRecord).filter(Boolean).slice(-limit);
 let plot=null;
 const status=q(config.statusId),body=q(config.tableBodyId),wrap=q(config.chartWrapId),host=q(config.chartHostId),count=q(config.countId);
 function persist(){
  try{localStorage.setItem(key,JSON.stringify(rows.slice(-limit)));return true}
  catch{if(status)status.textContent='Browser storage is unavailable. Export the log before leaving this page.';return false}
 }
 function draw(){
  if(!wrap||!host)return;
  if(plot){plot.destroy();plot=null}
  if(rows.length<2||!window.uPlot){wrap.hidden=true;return}
  wrap.hidden=false;host.replaceChildren();
  const x=rows.map((_,i)=>i),series=[x];
  for(const s of config.series)series.push(rows.map(r=>Number(r[s.key])).map(v=>Number.isFinite(v)?v:null));
  plot=new window.uPlot({
   width:Math.max(320,Math.floor(wrap.clientWidth||900)),height:260,
   cursor:{drag:{x:true,y:false,setScale:true}},scales:{x:{time:false}},
   axes:[{values:(u,ticks)=>ticks.map(v=>rows[Math.max(0,Math.min(rows.length-1,Math.round(v)))]?.date||'')},{}],
   series:[{},...config.series.map(s=>({label:s.label,width:2,points:{show:rows.length<=80}}))]
  },series,host);
 }
 function render(){
  if(count)count.textContent=String(rows.length);
  if(body)body.innerHTML=rows.slice().reverse().map(r=>'<tr>'+config.columns.map(c=>'<td>'+esc(c.format?c.format(r[c.key],r):r[c.key])+'</td>').join('')+'</tr>').join('');
  if(status)status.textContent=rows.length?rows.length+' measurement record'+(rows.length===1?'':'s')+' saved locally in this browser.':'No measurements saved yet.';
  draw();
 }
 function save(){
  const record=config.normalizeRecord(config.getRecord());
  if(!record){if(status)status.textContent='Enter a valid measurement before saving.';return}
  rows=[...rows,record].slice(-limit);persist();render();
 }
 function clear(){
  if(!rows.length)return;
  if(!confirm('Clear this local measurement log? Export it first if you need a copy.'))return;
  rows=[];persist();render();
 }
 function exportCsv(){
  const headers=config.columns.map(c=>c.header);
  const lines=[headers.map(asCsv).join(',')];
  for(const r of rows)lines.push(config.columns.map(c=>asCsv(r[c.key])).join(','));
  const blob=new Blob([lines.join('\n')+'\n'],{type:'text/csv;charset=utf-8'}),url=URL.createObjectURL(blob),a=document.createElement('a');
  a.href=url;a.download=(config.filename||'measurement-log')+'.csv';a.click();URL.revokeObjectURL(url);
 }
 async function importCsv(file){
  if(!file)return;
  try{
   let data=[];
   if(window.Papa?.parse){
    const parsed=window.Papa.parse(await file.text(),{header:true,skipEmptyLines:'greedy'});
    if(parsed.errors?.length&&(!parsed.data||!parsed.data.length))throw new Error(parsed.errors[0].message||'CSV parse failed');
    data=parsed.data;
   }else{
    const lines=(await file.text()).replace(/\r/g,'').split('\n').filter(Boolean);
    const heads=(lines.shift()||'').split(',');
    data=lines.map(line=>Object.fromEntries(line.split(',').map((v,i)=>[heads[i],v])));
   }
   const imported=data.map(row=>{
    const mapped={};for(const c of config.columns)mapped[c.key]=row[c.header]??row[c.key];
    return config.normalizeRecord(mapped);
   }).filter(Boolean);
   rows=[...rows,...imported].slice(-limit);persist();render();
   if(status)status.textContent='Imported '+imported.length+' valid record'+(imported.length===1?'':'s')+'. '+rows.length+' total saved locally.';
  }catch(error){if(status)status.textContent=error?.message||'Could not import this CSV.'}
 }
 q(config.saveBtnId)?.addEventListener('click',save);
 q(config.clearBtnId)?.addEventListener('click',clear);
 q(config.exportBtnId)?.addEventListener('click',exportCsv);
 q(config.importBtnId)?.addEventListener('click',()=>q(config.importInputId)?.click());
 q(config.importInputId)?.addEventListener('change',e=>{const f=e.target.files?.[0];e.target.value='';void importCsv(f)});
 window.addEventListener('resize',()=>{if(plot&&!wrap.hidden)plot.setSize({width:Math.max(320,Math.floor(wrap.clientWidth||900)),height:260})});
 render();
 return{save,render,getRows:()=>rows.slice()};
}
window.THCMeasurementJournal=Object.freeze({create});
})();