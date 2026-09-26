const state={catalog:null,sources:null,population:null,profiles:null,query:'',family:'all',scope:'all'};
const $=(s)=>document.querySelector(s);
const esc=(v='')=>String(v).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
async function load(){
  const [catalog,sources,population,profiles]=await Promise.all([
    fetch('/terpene-atlas/data/terpene-catalog-v1.json',{cache:'no-store'}).then(r=>{if(!r.ok)throw new Error('catalog '+r.status);return r.json()}),
    fetch('/terpene-atlas/data/sources-v1.json',{cache:'no-store'}).then(r=>{if(!r.ok)throw new Error('sources '+r.status);return r.json()}),
    fetch('/terpene-atlas/data/population-summary-v1.json',{cache:'no-store'}).then(r=>{if(!r.ok)throw new Error('population '+r.status);return r.json()}),
    fetch('/terpene-atlas/data/sample-profiles-v1.json',{cache:'no-store'}).then(r=>{if(!r.ok)throw new Error('profiles '+r.status);return r.json()})
  ]);
  state.catalog=catalog;state.sources=sources;state.population=population;state.profiles=profiles;
  $('[data-compound-count]').textContent=`${catalog.compounds.length} compounds`;
  buildCompareOptions();renderWheel();renderSources();renderPopulation();render();
}
function renderWheel(){
  const counts={};
  for(const item of state.catalog.compounds) counts[item.class]=(counts[item.class]||0)+1;
  $('[data-wheel-total]').textContent=`${state.catalog.compounds.length} compounds`;
  for(const [family,count] of Object.entries(counts)){
    const el=document.querySelector(`[data-wheel-count="${family}"]`);
    if(el)el.textContent=count;
  }
  for(const button of document.querySelectorAll('[data-wheel-family]')){
    button.classList.toggle('active',button.dataset.wheelFamily===state.family);
    button.onclick=()=>{
      state.family=button.dataset.wheelFamily;
      const select=$('[data-class-filter]');
      if(select)select.value=state.family;
      renderWheel();render();
      document.querySelector('#explorer')?.scrollIntoView({behavior:'smooth',block:'start'});
    };
  }
}
function renderSources(){
  const grid=$('[data-source-grid]');
  if(grid)grid.innerHTML=(state.sources.sources||[]).map(s=>`<article><small>${esc(s.type)} · ${esc(s.evidenceGrade)}</small><h3>${esc(s.title)}</h3><p>${esc(s.scope||'')}</p><a href="${esc(s.url)}" target="_blank" rel="noopener">Open source →</a></article>`).join('');
  const coverage=$('[data-coverage]');
  const c=state.catalog.coverage||{};
  if(coverage)coverage.innerHTML=`<strong>Current curated coverage: ${state.catalog.compounds.length} compounds.</strong> ${esc(c.target||'Catalog expansion continues.')} <span>Completeness claim: ${c.completenessClaim===true?'yes':'no'}.</span>`;
}
function renderPopulation(){
  const data=state.population;
  if(!data)return;
  const body=$('[data-population-body]');
  const count=$('[data-population-count]');
  const profileCount=$('[data-profile-count]');
  if(count)count.textContent=data.analytes.length;
  if(profileCount)profileCount.textContent=(state.profiles?.profiles||[]).length;
  const byId=new Map(state.catalog.compounds.map(x=>[x.id,x]));
  const sorted=[...data.analytes].sort((a,b)=>b.meanPpm-a.meanPpm);
  if(body)body.innerHTML=sorted.map(row=>{
    const compound=byId.get(row.compoundId);
    const name=compound?.canonicalName||row.reportedName;
    const max=`${row.maxQualifier||''}${Number(row.maxPpm).toLocaleString(undefined,{maximumFractionDigits:1})}`;
    return `<tr><td><a href="#explorer" data-population-compound="${esc(row.compoundId)}">${esc(name)}</a><br><small>${esc(row.reportedName)}</small></td><td>${row.meanPpm.toLocaleString(undefined,{maximumFractionDigits:1})}</td><td>${row.minPpm.toLocaleString(undefined,{maximumFractionDigits:1})}</td><td>${max}</td><td>${row.sdPpm.toLocaleString(undefined,{maximumFractionDigits:1})}</td><td>${row.cvPercent.toLocaleString(undefined,{maximumFractionDigits:1})}</td></tr>`;
  }).join('');
  for(const link of document.querySelectorAll('[data-population-compound]'))link.addEventListener('click',()=>{
    const compound=byId.get(link.dataset.populationCompound);
    state.query=compound?.canonicalName||link.textContent||'';
    $('[data-search]').value=state.query;
    state.family='all';$('[data-class-filter]').value='all';
    renderWheel();render();
  });
}
function populationFor(id){
  return (state.population?.analytes||[]).filter(row=>row.compoundId===id);
}
function sourceFor(id){
  return (state.sources?.sources||[]).find(s=>s.id===id);
}
function showCompound(id){
  const x=state.catalog.compounds.find(item=>item.id===id);
  if(!x)return;
  const rows=populationFor(id);
  const sources=(x.evidence||[]).map(sourceFor).filter(Boolean);
  const measured=rows.length?rows.map(row=>`<div class="record-measurement"><small>${esc(row.reportedName)} · population n=${state.population.sampleCount} · ${esc(state.population.unit)}</small><strong>${Number(row.meanPpm).toLocaleString(undefined,{maximumFractionDigits:1})} mean ppm</strong><p>Range ${Number(row.minPpm).toLocaleString(undefined,{maximumFractionDigits:1})}–${esc(row.maxQualifier||'')}${Number(row.maxPpm).toLocaleString(undefined,{maximumFractionDigits:1})}; SD ${Number(row.sdPpm).toLocaleString(undefined,{maximumFractionDigits:1})}; CV ${Number(row.cvPercent).toLocaleString(undefined,{maximumFractionDigits:1})}%.</p></div>`).join(''):'<p>No mapped quantitative population summary is loaded for this compound yet.</p>';
  const sourceHtml=sources.length?sources.map(s=>`<div class="record-source"><small>${esc(s.type)} · ${esc(s.evidenceGrade)}</small><strong>${esc(s.title)}</strong><p>${esc(s.scope||'')}</p><a href="${esc(s.url)}" target="_blank" rel="noopener">Open source →</a></div>`).join(''):'<p>No resolved source record.</p>';
  $('[data-dialog-content]').innerHTML=`<div class="record-hero"><span class="badge">${esc(x.class)}</span><h2>${esc(x.canonicalName)}</h2><p>${esc(x.notes||'')}</p></div><div class="record-grid"><div><small>Formula</small><strong>${esc(x.formula||'—')}</strong></div><div><small>Subclass</small><strong>${esc(x.subclass||'—')}</strong></div><div><small>Aliases</small><strong>${esc((x.aliases||[]).join(', ')||'—')}</strong></div><div><small>Aroma descriptors</small><strong>${esc((x.aromaDescriptors||[]).join(', ')||'Not yet curated')}</strong></div><div><small>Cannabis occurrence</small><strong>${esc(x.cannabisOccurrence||'—')}</strong></div><div><small>Evidence grade</small><strong>${esc(x.evidenceGrade||'—')}</strong></div><div><small>Stereochemistry</small><strong>${esc(x.stereochemistry||'not resolved')}</strong></div><div><small>Isomer group</small><strong>${esc(x.isomerGroup||'—')}</strong></div></div><h3>Measured population context</h3>${measured}<h3>Evidence sources</h3><div class="record-sources">${sourceHtml}</div>`;
  const dialog=$('[data-compound-dialog]');
  if(typeof dialog.showModal==='function')dialog.showModal(); else dialog.setAttribute('open','');
}
function validateProfile(profile){
  const errors=[];
  for(const key of ['sampleId','displayName','source','matrix','method','unit','measurements']) if(profile?.[key]===undefined||profile?.[key]===null||profile?.[key]==='')errors.push(`Missing ${key}`);
  if(!Array.isArray(profile?.measurements)||profile.measurements.length===0)errors.push('measurements must be a non-empty array');
  for(const [index,row] of (profile?.measurements||[]).entries()){
    if(!row.compoundId)errors.push(`measurement ${index+1}: missing compoundId`);
    if(row.value===undefined&&row.qualifier===undefined)errors.push(`measurement ${index+1}: provide value or qualifier`);
  }
  return errors;
}
function renderImportedProfile(profile){
  const errors=validateProfile(profile);
  const status=$('[data-profile-status]'),result=$('[data-profile-result]');
  if(errors.length){
    status.innerHTML=`<strong>Profile rejected</strong><p>${errors.map(esc).join(' · ')}</p>`;
    result.hidden=true;return;
  }
  const known=new Map(state.catalog.compounds.map(x=>[x.id,x]));
  status.innerHTML=`<strong>${esc(profile.displayName)}</strong><p>${esc(profile.sampleId)} · ${esc(profile.matrix)} · ${esc(profile.method)} · ${esc(profile.unit)}</p>`;
  result.innerHTML=`<h3>Measured sample</h3><p><strong>Source:</strong> ${esc(typeof profile.source==='string'?profile.source:JSON.stringify(profile.source))}</p><table><thead><tr><th>Compound</th><th>Result</th><th>Atlas status</th></tr></thead><tbody>${profile.measurements.map(row=>{const item=known.get(row.compoundId);const resultText=row.value!==undefined?`${esc(row.value)} ${esc(profile.unit)}`:esc(row.qualifier||'reported');return `<tr><td>${esc(item?.canonicalName||row.compoundId)}</td><td>${resultText}</td><td>${item?'mapped':'unmapped analyte'}</td></tr>`;}).join('')}</tbody></table><p class="population-note">This browser view does not convert or reinterpret laboratory units. Compare only profiles that use compatible matrices, methods, units, and reporting conventions.</p>`;
  result.hidden=false;
}
function filtered(){
  const q=state.query.trim().toLowerCase();
  return state.catalog.compounds.filter(x=>{
    const hay=[x.canonicalName,x.id,x.class,x.subclass,x.formula,x.stereochemistry,x.isomerGroup,...(x.aliases||[]),...(x.aromaDescriptors||[])].join(' ').toLowerCase();
    return (!q||hay.includes(q))&&(state.family==='all'||x.class===state.family)&&(state.scope==='all'||x.scope===state.scope);
  });
}
function card(x){
  const measured=populationFor(x.id).length>0?'<span class="measured-badge">measured data</span>':'';
  return `<article class="card"><div class="card-head"><div><span class="badge">${esc(x.class)}</span>${measured}<h3>${esc(x.canonicalName)}</h3></div><span class="formula">${esc(x.formula||'formula pending')}</span></div><div class="meta"><div><small>Subclass</small><strong>${esc(x.subclass||'—')}</strong></div><div><small>Cannabis</small><strong>${esc(x.cannabisOccurrence||'unknown')}</strong></div></div><div class="chips">${(x.aromaDescriptors||[]).map(v=>`<span class="chip">${esc(v)}</span>`).join('')}</div><details><summary>Evidence & naming</summary><p><strong>Aliases:</strong> ${esc((x.aliases||[]).join(', ')||'None listed')}</p><p><strong>Evidence:</strong> ${esc((x.evidence||[]).join(', '))}</p><p><strong>Grade:</strong> ${esc(x.evidenceGrade||'—')}</p><p>${esc(x.notes||'')}</p></details><button type="button" class="record-button" data-record-id="${esc(x.id)}">Open full record</button></article>`;
}
function render(){
  const items=filtered();
  $('[data-grid]').innerHTML=items.map(card).join('');
  $('[data-result-count]').textContent=`${items.length} of ${state.catalog.compounds.length} compounds`;
  $('[data-empty]').hidden=items.length!==0;
  for(const button of document.querySelectorAll('[data-record-id]'))button.addEventListener('click',()=>showCompound(button.dataset.recordId));
  renderCompare();
}
function buildCompareOptions(){
  const options=state.catalog.compounds.map(x=>`<option value="${esc(x.id)}">${esc(x.canonicalName)}</option>`).join('');
  $('[data-compare-a]').innerHTML=options;$('[data-compare-b]').innerHTML=options;
  if(state.catalog.compounds[1])$('[data-compare-b]').value=state.catalog.compounds[1].id;
}
function compareCard(x){
  return `<article class="compare-card"><h3>${esc(x.canonicalName)}</h3><dl><dt>Family</dt><dd>${esc(x.class)}</dd><dt>Subclass</dt><dd>${esc(x.subclass||'—')}</dd><dt>Formula</dt><dd>${esc(x.formula||'—')}</dd><dt>Aroma</dt><dd>${esc((x.aromaDescriptors||[]).join(', ')||'—')}</dd><dt>Aliases</dt><dd>${esc((x.aliases||[]).join(', ')||'—')}</dd><dt>Cannabis</dt><dd>${esc(x.cannabisOccurrence||'—')}</dd><dt>Evidence</dt><dd>${esc(x.evidenceGrade||'—')}</dd></dl><p>${esc(x.notes||'')}</p></article>`;
}
function renderCompare(){
  const a=state.catalog.compounds.find(x=>x.id===$('[data-compare-a]').value)||state.catalog.compounds[0];
  const b=state.catalog.compounds.find(x=>x.id===$('[data-compare-b]').value)||state.catalog.compounds[1]||a;
  $('[data-compare-grid]').innerHTML=[a,b].map(compareCard).join('');
}
$('[data-search]').addEventListener('input',e=>{state.query=e.target.value;render()});
$('[data-class-filter]').addEventListener('change',e=>{state.family=e.target.value;renderWheel();render()});
$('[data-scope-filter]').addEventListener('change',e=>{state.scope=e.target.value;render()});
$('[data-compare-a]').addEventListener('change',renderCompare);
$('[data-compare-b]').addEventListener('change',renderCompare);
load().catch(error=>{$('[data-grid]').innerHTML=`<div class="empty">Terpene Atlas data could not load. ${esc(error.message)}</div>`;console.error('[Terpene Atlas]',error)});
$('[data-dialog-close]')?.addEventListener('click',()=> $('[data-compound-dialog]')?.close());
$('[data-compound-dialog]')?.addEventListener('click',e=>{if(e.target===e.currentTarget)e.currentTarget.close()});
$('[data-profile-file]')?.addEventListener('change',async e=>{
  const file=e.target.files?.[0]; if(!file)return;
  try{const profile=JSON.parse(await file.text());renderImportedProfile(profile);}
  catch(error){$('[data-profile-status]').innerHTML=`<strong>Profile rejected</strong><p>Invalid JSON: ${esc(error.message)}</p>`; $('[data-profile-result]').hidden=true;}
});