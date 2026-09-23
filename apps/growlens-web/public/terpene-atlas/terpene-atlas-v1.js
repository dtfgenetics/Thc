const state={catalog:null,sources:null,query:'',family:'all',scope:'all'};
const $=(s)=>document.querySelector(s);
const esc=(v='')=>String(v).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
async function load(){
  const [catalog,sources]=await Promise.all([
    fetch('/terpene-atlas/data/terpene-catalog-v1.json',{cache:'no-store'}).then(r=>{if(!r.ok)throw new Error('catalog '+r.status);return r.json()}),
    fetch('/terpene-atlas/data/sources-v1.json',{cache:'no-store'}).then(r=>{if(!r.ok)throw new Error('sources '+r.status);return r.json()})
  ]);
  state.catalog=catalog;state.sources=sources;
  $('[data-compound-count]').textContent=`${catalog.compounds.length} compounds`;
  buildCompareOptions();renderWheel();renderSources();render();
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
function filtered(){
  const q=state.query.trim().toLowerCase();
  return state.catalog.compounds.filter(x=>{
    const hay=[x.canonicalName,x.id,x.class,x.subclass,x.formula,...(x.aliases||[]),...(x.aromaDescriptors||[])].join(' ').toLowerCase();
    return (!q||hay.includes(q))&&(state.family==='all'||x.class===state.family)&&(state.scope==='all'||x.scope===state.scope);
  });
}
function card(x){
  return `<article class="card"><div class="card-head"><div><span class="badge">${esc(x.class)}</span><h3>${esc(x.canonicalName)}</h3></div><span class="formula">${esc(x.formula||'formula pending')}</span></div><div class="meta"><div><small>Subclass</small><strong>${esc(x.subclass||'—')}</strong></div><div><small>Cannabis</small><strong>${esc(x.cannabisOccurrence||'unknown')}</strong></div></div><div class="chips">${(x.aromaDescriptors||[]).map(v=>`<span class="chip">${esc(v)}</span>`).join('')}</div><details><summary>Evidence & naming</summary><p><strong>Aliases:</strong> ${esc((x.aliases||[]).join(', ')||'None listed')}</p><p><strong>Evidence:</strong> ${esc((x.evidence||[]).join(', '))}</p><p><strong>Grade:</strong> ${esc(x.evidenceGrade||'—')}</p><p>${esc(x.notes||'')}</p></details></article>`;
}
function render(){
  const items=filtered();
  $('[data-grid]').innerHTML=items.map(card).join('');
  $('[data-result-count]').textContent=`${items.length} of ${state.catalog.compounds.length} compounds`;
  $('[data-empty]').hidden=items.length!==0;
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