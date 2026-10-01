(() => {
  const KEY='dtf.atlas.observation-notebook.v1';
  const root=document.querySelector('[data-app]');
  const esc=(v)=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const load=()=>{try{const p=JSON.parse(localStorage.getItem(KEY)||'{"entries":[]}');return Array.isArray(p.entries)?p.entries.filter(x=>x&&x.id&&x.title&&x.observations).slice(0,250):[];}catch{return[];}};
  const date=(e)=>{const d=new Date(e.observedAt||e.createdAt||e.updatedAt||'');return Number.isNaN(d.getTime())?'Date not recorded':new Intl.DateTimeFormat(undefined,{dateStyle:'medium',timeStyle:'short'}).format(d);};
  const delta=(a,b,s='')=>{if(!String(a||'').trim()||!String(b||'').trim())return'No numeric delta';const x=parseFloat(a),y=parseFloat(b);if(!Number.isFinite(x)||!Number.isFinite(y))return'No numeric delta';const d=y-x;return 'Δ '+(d>0?'+':'')+Number(d.toFixed(2))+s;};
  const row=(label,a,b)=>`<div class="row"><strong>${esc(label)}</strong><span>${esc(a||'Not recorded')}</span><span>${esc(b||'Not recorded')}</span><b class="${a===b?'same':'change'}">${a===b?'Same':'Changed'}</b></div>`;
  const narrative=(label,a,b)=>`<section class="narrative"><header><strong>${esc(label)}</strong><small>${a===b?'Same recorded text':'Recorded text changed'}</small></header><div class="pair"><article><small>Baseline</small><p>${esc(a||'Not recorded')}</p></article><article><small>Follow-up</small><p>${esc(b||'Not recorded')}</p></article></div></section>`;
  let baselineId='',followupId='';
  function render(){
    const entries=load().sort((a,b)=>String(b.observedAt||b.updatedAt||'').localeCompare(String(a.observedAt||a.updatedAt||'')));
    if(entries.length<2){root.innerHTML=`<div class="empty"><strong>${entries.length?'Save one more observation to compare.':'Save two observations to compare.'}</strong><p>The comparison view needs a baseline and follow-up.</p><a class="button" href="/atlas/notebook/">Open Observation Notebook</a></div>`;return;}
    const follow=entries.find(e=>e.id===followupId)||entries[0];
    const base=entries.find(e=>e.id===baselineId&&e.id!==follow.id)||entries.find(e=>e.id!==follow.id)||entries[1];
    baselineId=base.id;followupId=follow.id;
    const options=(selected,disabled)=>entries.map(e=>`<option value="${esc(e.id)}" ${e.id===selected?'selected':''} ${e.id===disabled?'disabled':''}>${esc(e.title)} · ${esc(date(e))}</option>`).join('');
    root.innerHTML=`
      <section class="selectors"><label>Baseline observation<select data-baseline>${options(base.id,follow.id)}</select></label><div class="arrow">→</div><label>Follow-up observation<select data-followup>${options(follow.id,base.id)}</select></label></section>
      <section class="summary"><article><small>Baseline</small><h2>${esc(base.title)}</h2><span>${esc(date(base))} · ${esc(base.status||'')}</span></article><article><small>Follow-up</small><h2>${esc(follow.title)}</h2><span>${esc(date(follow))} · ${esc(follow.status||'')}</span></article></section>
      <section class="matrix"><div class="row header"><strong>Evidence field</strong><span>Baseline</span><span>Follow-up</span><b>Change</b></div>
      ${row('Growth stage',base.stage,follow.stage)}${row('Plant area',base.plantArea,follow.plantArea)}${row('Visible pattern',base.pattern,follow.pattern)}${row('Progression',base.progression,follow.progression)}${row('Root-zone moisture',base.rootZoneMoisture,follow.rootZoneMoisture)}${row('Status',base.status,follow.status)}</section>
      <section class="measure"><article><small>pH</small><div>${esc(base.ph||'—')} → ${esc(follow.ph||'—')}</div><strong>${esc(delta(base.ph,follow.ph))}</strong></article><article><small>EC</small><div>${esc(base.ec||'—')} → ${esc(follow.ec||'—')}</div><strong>${esc(delta(base.ec,follow.ec))}</strong></article><article><small>RH</small><div>${esc(base.relativeHumidity||'—')} → ${esc(follow.relativeHumidity||'—')}</div><strong>${esc(delta(base.relativeHumidity,follow.relativeHumidity,'%'))}</strong></article><article><small>Temperature context</small><div>${esc(base.temperatureContext||'—')} → ${esc(follow.temperatureContext||'—')}</div><strong>${base.temperatureContext===follow.temperatureContext?'Same recorded context':'Context changed'}</strong></article></section>
      <div class="narratives">${narrative('Observed evidence',base.observations,follow.observations)}${narrative('Irrigation context',base.irrigationContext,follow.irrigationContext)}${narrative('Light / airflow context',base.lightAirflowContext,follow.lightAirflowContext)}${narrative('Working differential',base.workingDifferential,follow.workingDifferential)}${narrative('Next discriminating check',base.nextCheck,follow.nextCheck)}</div>
      <div class="actions"><a class="button" href="/atlas/notebook/">Back to Observation Notebook</a><a class="button" href="/atlas/diagnostics/">Open Diagnostic Lab</a></div>`;
    root.querySelector('[data-baseline]').addEventListener('change',e=>{baselineId=e.target.value;render();});
    root.querySelector('[data-followup]').addEventListener('change',e=>{followupId=e.target.value;render();});
  }
  render();
  addEventListener('storage',render);
})();