import {collectManualCultivationMeasurement} from '/assets/thc-cultivation-data-ui-v1.mjs';
(() => {
  const KEY='dtf.atlas.observation-notebook.v1';
  const MAX=250;
  const form=document.querySelector('[data-form]');
  const entriesRoot=document.querySelector('[data-entries]');
  const message=document.querySelector('[data-message]');
  const filter=document.querySelector('[data-filter]');
  const cancel=document.querySelector('[data-cancel]');
  const editorTitle=document.querySelector('[data-editor-title]');
  let editingId=null;

  const esc=(v)=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const clean=(v,n=6000)=>typeof v==='string'?v.trim().slice(0,n):'';
  const load=()=>{
    try{
      const raw=JSON.parse(localStorage.getItem(KEY)||'{"version":1,"entries":[]}');
      if(!raw||!Array.isArray(raw.entries)) return {version:1,entries:[]};
      const seen=new Set();
      const entries=[];
      for(const item of raw.entries){
        if(!item||typeof item!=='object') continue;
        const id=clean(item.id,120), title=clean(item.title,180), observations=clean(item.observations,6000);
        if(!id||!title||!observations||seen.has(id)) continue;
        seen.add(id);
        entries.push({...item,id,title,observations});
        if(entries.length>=MAX) break;
      }
      return {version:1,entries};
    }catch{return {version:1,entries:[]};}
  };
  const save=(state)=>localStorage.setItem(KEY,JSON.stringify({version:1,entries:state.entries.slice(0,MAX)}));
  const id=()=>globalThis.crypto?.randomUUID?.()||'obs-'+Date.now()+'-'+Math.random().toString(36).slice(2);
  const state=()=>load();
  const values=()=>Object.fromEntries(new FormData(form).entries());

  function setMessage(text){message.textContent=text||'';}
  function reset(){
    editingId=null;form.reset();cancel.hidden=true;editorTitle.textContent='New observation';setMessage('');
  }
  function counts(items){
    document.querySelector('[data-total]').textContent=items.length;
    document.querySelector('[data-open]').textContent=items.filter(x=>x.status!=='Resolved').length;
    document.querySelector('[data-resolved]').textContent=items.filter(x=>x.status==='Resolved').length;
  }
  function render(){
    const current=state();
    counts(current.entries);
    const selected=filter.value;
    const visible=[...current.entries].sort((a,b)=>String(b.updatedAt).localeCompare(String(a.updatedAt))).filter(x=>selected==='All'||x.status===selected);
    if(!visible.length){entriesRoot.innerHTML='<div class="empty">No observations match this view.</div>';return;}
    entriesRoot.innerHTML=visible.map(e=>`<article class="entry" data-id="${esc(e.id)}">
      <div class="entry-head"><div><h3>${esc(e.title)}</h3><small>${esc(e.observedAt||e.updatedAt||'Date not recorded')}</small></div><strong>${esc(e.status||'Open observation')}</strong></div>
      <div class="tags"><span>${esc(e.stage||'Stage not recorded')}</span><span>${esc(e.plantArea||'Area not recorded')}</span><span>${esc(e.pattern||'Pattern not recorded')}</span><span>${esc(e.progression||'Progression not recorded')}</span></div>
      <p><strong>Observed:</strong> ${esc(e.observations)}</p>
      ${e.workingDifferential?`<p><strong>Working differential:</strong> ${esc(e.workingDifferential)}</p>`:''}
      ${e.nextCheck?`<p><strong>Next check:</strong> ${esc(e.nextCheck)}</p>`:''}
      <div class="entry-actions"><button type="button" data-edit>Edit</button><button class="danger" type="button" data-delete>Delete</button></div>
    </article>`).join('');
  }
  form.addEventListener('submit',(event)=>{
    event.preventDefault();
    const data=values();
    const title=clean(data.title,180), observations=clean(data.observations,6000);
    if(!title||!observations){setMessage('Add a short title and the observation you actually saw before saving.');return;}
    const current=state(), now=new Date().toISOString();
    const existing=editingId?current.entries.find(x=>x.id===editingId):null;
    const next={...data,id:existing?.id||id(),createdAt:existing?.createdAt||now,updatedAt:now,title,observations};
    save({version:1,entries:[next,...current.entries.filter(x=>x.id!==next.id)]});
    collectManualCultivationMeasurement({type:'plant-observation',toolId:'plant-atlas',observedAt:next.observedAt?new Date(next.observedAt).toISOString():now,stage:next.stage,values:{symptoms:[title,observations],locationOnPlant:next.plantArea,visiblePattern:next.pattern,progression:next.progression,status:next.status,recordAction:existing?'updated':'created'},method:'atlas-observation-notebook'});
    reset();setMessage(existing?'Observation updated.':'Observation saved on this device.');render();
  });
  entriesRoot.addEventListener('click',(event)=>{
    const article=event.target.closest('[data-id]');if(!article)return;
    const current=state(), entry=current.entries.find(x=>x.id===article.dataset.id);if(!entry)return;
    if(event.target.matches('[data-delete]')){
      if(!confirm(`Delete observation “${entry.title}”?`))return;
      save({version:1,entries:current.entries.filter(x=>x.id!==entry.id)});if(editingId===entry.id)reset();render();return;
    }
    if(event.target.matches('[data-edit]')){
      editingId=entry.id;
      for(const el of form.elements){if(el.name&&Object.hasOwn(entry,el.name))el.value=entry[el.name]??'';}
      editorTitle.textContent='Edit observation';cancel.hidden=false;setMessage('');scrollTo({top:0,behavior:'smooth'});
    }
  });
  cancel.addEventListener('click',reset);
  filter.addEventListener('change',render);
  document.querySelector('[data-export]').addEventListener('click',()=>{
    const payload={format:'DTF Atlas Observation Notebook',version:1,exportedAt:new Date().toISOString(),entries:state().entries};
    const blob=new Blob([JSON.stringify(payload,null,2)],{type:'application/json'}),url=URL.createObjectURL(blob),a=document.createElement('a');
    a.href=url;a.download='dtf-atlas-observations-'+new Date().toISOString().slice(0,10)+'.json';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);
  });
  document.querySelector('[data-import]').addEventListener('change',async(event)=>{
    const file=event.target.files?.[0];if(!file)return;
    try{
      const parsed=JSON.parse(await file.text());
      const incoming=Array.isArray(parsed.entries)?parsed.entries:[];
      const current=state(), ids=new Set(current.entries.map(x=>x.id));
      const merged=[...current.entries];
      for(const item of incoming){if(item&&item.id&&!ids.has(item.id)&&item.title&&item.observations){ids.add(item.id);merged.push(item);}}
      save({version:1,entries:merged.slice(0,MAX)});setMessage('Notebook import complete.');render();
    }catch{setMessage('Could not import that JSON file.');}
    event.target.value='';
  });
  render();
})();