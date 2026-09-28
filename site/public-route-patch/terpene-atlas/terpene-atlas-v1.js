const state={catalog:null,sources:null,population:null,profiles:null,factors:null,evidence:null,query:'',family:'all',scope:'all',factorCategory:'all'};
const $=(s)=>document.querySelector(s);
const esc=(v='')=>String(v).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
async function load(){
  const [catalog,sources,population,profiles,factors,evidence,identityAudit,normalization]=await Promise.all([
    fetch('/terpene-atlas/data/terpene-catalog-v1.json',{cache:'no-store'}).then(r=>{if(!r.ok)throw new Error('catalog '+r.status);return r.json()}),
    fetch('/terpene-atlas/data/sources-v1.json',{cache:'no-store'}).then(r=>{if(!r.ok)throw new Error('sources '+r.status);return r.json()}),
    fetch('/terpene-atlas/data/population-summary-v1.json',{cache:'no-store'}).then(r=>{if(!r.ok)throw new Error('population '+r.status);return r.json()}),
    fetch('/terpene-atlas/data/sample-profiles-v1.json',{cache:'no-store'}).then(r=>{if(!r.ok)throw new Error('profiles '+r.status);return r.json()}),
    fetch('/terpene-atlas/data/profile-factors-v1.json',{cache:'no-store'}).then(r=>{if(!r.ok)throw new Error('factors '+r.status);return r.json()}),
    fetch('/terpene-atlas/data/evidence-claims-v1.json',{cache:'no-store'}).then(r=>{if(!r.ok)throw new Error('evidence '+r.status);return r.json()}),
    fetch('/terpene-atlas/data/identity-audit-v1.json',{cache:'no-store'}).then(r=>{if(!r.ok)throw new Error('identity audit '+r.status);return r.json()}),
    fetch('/terpene-atlas/data/analyte-normalization-v1.json',{cache:'no-store'}).then(r=>{if(!r.ok)throw new Error('normalization '+r.status);return r.json()})
  ]);
  state.catalog=catalog;state.sources=sources;state.population=population;state.profiles=profiles;state.factors=factors;state.evidence=evidence;state.identityAudit=identityAudit;state.normalization=normalization;
  $('[data-compound-count]').textContent=`${catalog.compounds.length} compounds`;
  buildCompareOptions();renderWheel();renderSources();renderFactors();renderEvidenceSafety();renderPopulation();render();
  const requested=new URLSearchParams(location.search).get('compound');
  if(requested)showCompound(requested);
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
  const quality=$('[data-data-quality]');
  const c=state.catalog.coverage||{};
  if(coverage)coverage.innerHTML=`<strong>Current curated coverage: ${state.catalog.compounds.length} compounds.</strong> <span>${esc(c.catalogState||'expandable catalog')}</span><p>${esc(c.scopeBoundary||c.target||'Catalog expansion continues.')}</p><p><strong>Reference inventory:</strong> ${esc(c.referenceInventoryNote||'')}</p><span>Global completeness claim: ${c.completenessClaim===true?'yes':'no'}.</span>`;
  if(quality){
    const items=state.catalog.compounds||[];
    const formulas=items.filter(x=>x.formula).length;
    const identifiers=items.filter(x=>x.pubchemCid).length;
    const aromas=items.filter(x=>Array.isArray(x.aromaDescriptors)&&x.aromaDescriptors.length).length;
    const verified=items.filter(x=>x.identityStatus==='verified').length;
    const a=state.identityAudit?.counts||{},mp=state.identityAudit?.measuredPopulation||{};
    quality.innerHTML=`<strong>Identity QA:</strong> formulas ${formulas}/${items.length} · PubChem IDs ${identifiers}/${items.length} · verified identities ${verified}/${items.length}. <strong>Measured population:</strong> ${Math.max(0,(mp.analytes||0)-(mp.withoutPubchemCid||0))}/${mp.analytes||0} analytes carry PubChem IDs; ${mp.withoutPubchemCid||0} remains explicitly unresolved. <strong>${a.pubchemCidMissing??(items.length-identifiers)} catalog records still need structure-level identifier review.</strong> Missing identity fields are not inferred automatically. Quantitative lab analytes preserve the resolution actually reported by the source.`;
  }
}
function renderFactors(){
  const grid=$('[data-factor-grid]');
  if(!grid||!state.factors)return;
  const items=(state.factors.factors||[]).filter(x=>state.factorCategory==='all'||x.category===state.factorCategory);
  grid.innerHTML=items.map(x=>`<article class="factor-card"><span class="factor-category">${esc(x.category)}</span><h3>${esc(x.title)}</h3><p>${esc(x.summary)}</p><p class="factor-caution"><strong>Interpretation caution:</strong> ${esc(x.caution)}</p><details><summary>What to record</summary><ul>${(x.whatToRecord||[]).map(v=>`<li>${esc(v)}</li>`).join('')}</ul></details><details><summary>Evidence</summary><p>${(x.evidence||[]).map(id=>{const s=sourceFor(id);return s?`<a href="${esc(s.url)}" target="_blank" rel="noopener">${esc(s.title)}</a>`:esc(id)}).join(' · ')}</p></details></article>`).join('');
  for(const button of document.querySelectorAll('[data-factor-category]')){
    button.classList.toggle('active',button.dataset.factorCategory===state.factorCategory);
    button.onclick=()=>{state.factorCategory=button.dataset.factorCategory;renderFactors();};
  }
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
function evidenceFor(id){
  return (state.evidence?.compoundEvidence||[]).filter(row=>row.compoundId===id);
}
function renderEvidenceSafety(){
  const general=$('[data-general-evidence]');
  const safety=$('[data-safety-grid]');
  const rule=$('[data-evidence-rule]');
  if(rule&&state.evidence?.policy?.rule) rule.textContent=state.evidence.policy.rule;
  if(general)general.innerHTML=(state.evidence?.generalEvidence||[]).map(item=>`<article class="evidence-card"><span class="badge">evidence context</span><h3>${esc(item.title)}</h3><p>${esc(item.finding)}</p><div class="evidence-models">${(item.evidenceModels||[]).map(m=>`<span>${esc(m)}</span>`).join('')}</div><p><strong>Human evidence:</strong> ${esc(item.humanEvidenceStatus||'not specified')}</p><p class="evidence-limit">${esc(item.limitations||'')}</p></article>`).join('');
  if(safety)safety.innerHTML=(state.evidence?.safety||[]).map(item=>`<article class="safety-card"><span class="badge">safety context</span><h3>${esc(item.compoundIds?.length?item.compoundIds.map(id=>state.catalog.compounds.find(x=>x.id===id)?.canonicalName||id).join(', '):'General terpene exposure')}</h3><p>${esc(item.concern)}</p><p><strong>Evidence context:</strong> ${esc(item.evidenceContext||'')}</p><p class="evidence-limit">${esc(item.limitation||'')}</p></article>`).join('');
}
function populationFor(id){
  return (state.population?.analytes||[]).filter(row=>row.compoundId===id);
}
function sourceFor(id){
  return (state.sources?.sources||[]).find(s=>s.id===id);
}
function downloadableCompoundRecord(x){
  const mechanism=evidenceFor(x.id),population=populationFor(x.id),sourceIds=Array.from(new Set([...(x.evidence||[]),...mechanism.flatMap(r=>r.sources||[])])),sources=sourceIds.map(sourceFor).filter(Boolean);
  return{schema:'thc-terpene-compound-record',version:1,exportedAt:new Date().toISOString(),compound:x,populationContext:{sampleCount:state.population?.sampleCount??null,unit:state.population?.unit??null,records:population},evidenceClaims:mechanism,sources};
}
function downloadCompoundRecord(x){const payload=downloadableCompoundRecord(x),blob=new Blob([JSON.stringify(payload,null,2)],{type:'application/json'}),url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download=(x.id||'terpene-record')+'.json';a.click();URL.revokeObjectURL(url)}
function showCompound(id){
  const x=state.catalog.compounds.find(item=>item.id===id);
  if(!x)return;
  const params=new URLSearchParams(location.search);
  params.set('compound',id);
  history.replaceState(null,'',`${location.pathname}?${params.toString()}${location.hash}`);
  const rows=populationFor(id);
  const mechanismRows=evidenceFor(id);
  const sources=Array.from(new Set([...(x.evidence||[]),...mechanismRows.flatMap(r=>r.sources||[])])).map(sourceFor).filter(Boolean);
  const measured=rows.length?rows.map(row=>`<div class="record-measurement"><small>${esc(row.reportedName)} · population n=${state.population.sampleCount} · ${esc(state.population.unit)}</small><strong>${Number(row.meanPpm).toLocaleString(undefined,{maximumFractionDigits:1})} mean ppm</strong><p>Range ${Number(row.minPpm).toLocaleString(undefined,{maximumFractionDigits:1})}–${esc(row.maxQualifier||'')}${Number(row.maxPpm).toLocaleString(undefined,{maximumFractionDigits:1})}; SD ${Number(row.sdPpm).toLocaleString(undefined,{maximumFractionDigits:1})}; CV ${Number(row.cvPercent).toLocaleString(undefined,{maximumFractionDigits:1})}%.</p></div>`).join(''):'<p>No mapped quantitative population summary is loaded for this compound yet.</p>';
  const mechanismHtml=mechanismRows.length?mechanismRows.map(row=>`<div class="mechanism-item"><small>${esc(row.topic)} · ${esc(row.confidence||'')}</small><p>${esc(row.finding)}</p><div class="evidence-models">${(row.evidenceModels||[]).map(m=>`<span>${esc(m)}</span>`).join('')}</div><p><strong>Human evidence:</strong> ${esc(row.humanEvidenceStatus||'')}</p><p class="evidence-limit">${esc(row.limitations||'')}</p></div>`).join(''):'<p>No compound-specific mechanism claim is published in this Atlas record yet.</p>';
  const sourceHtml=sources.length?sources.map(s=>`<div class="record-source"><small>${esc(s.type)} · ${esc(s.evidenceGrade)}</small><strong>${esc(s.title)}</strong><p>${esc(s.scope||'')}</p><a href="${esc(s.url)}" target="_blank" rel="noopener">Open source →</a></div>`).join(''):'<p>No resolved source record.</p>';
  const identityLabel=({'verified':'verified structure','partially-resolved':'partial identity','unresolved':'unresolved identity','parent-concept':'parent concept'})[x.identityStatus]||'identity review pending';
  const pubchemLink=x.pubchemCid?`<a href="https://pubchem.ncbi.nlm.nih.gov/compound/${encodeURIComponent(x.pubchemCid)}" target="_blank" rel="noopener">PubChem CID ${esc(x.pubchemCid)}</a>`:'No PubChem CID assigned';
  const structureHtml=x.pubchemCid?`<figure class="compound-structure"><img loading="lazy" src="https://pubchem.ncbi.nlm.nih.gov/rest/pug/compound/cid/${encodeURIComponent(x.pubchemCid)}/PNG?record_type=2d" alt="PubChem 2D structure for ${esc(x.canonicalName)}"><figcaption>External 2D structure rendered from the resolved PubChem CID. <a href="https://pubchem.ncbi.nlm.nih.gov/compound/${encodeURIComponent(x.pubchemCid)}" target="_blank" rel="noopener">Open PubChem record →</a></figcaption></figure>`:'<div class="compound-structure unresolved"><strong>No structure authority resolved.</strong><p>This catalog record does not currently carry a PubChem CID, so the Atlas does not generate or infer a chemical structure.</p></div>';
  const identityHtml=`<div class="record-measurement"><small>Chemical identity resolution</small><strong>${esc(identityLabel)}</strong><p>${esc(x.analyteResolution||'Structure-level identity has not been fully resolved for this catalog record.')}</p><p><strong>Authority:</strong> ${pubchemLink}${x.inchikey?` · InChIKey <code>${esc(x.inchikey)}</code>`:''}${x.identitySource?` · source ${esc(x.identitySource)}`:''}${x.identityVerifiedOn?` · reviewed ${esc(x.identityVerifiedOn)}`:''}</p><p class="evidence-limit">Identity status describes how precisely the chemical structure is resolved. It does not imply stronger evidence for aroma, biological effect, cultivar association, or clinical outcome.</p></div>`;
  $('[data-dialog-content]').innerHTML=`<div class="record-hero"><span class="badge">${esc(x.class)}</span><h2>${esc(x.canonicalName)}</h2><p>${esc(x.notes||'')}</p><div class="record-actions"><button type="button" data-download-compound>Download JSON record</button>${x.pubchemCid?`<a href="https://pubchem.ncbi.nlm.nih.gov/compound/${encodeURIComponent(x.pubchemCid)}" target="_blank" rel="noopener">Open PubChem</a>`:''}</div></div><div class="record-grid"><div><small>Formula</small><strong>${esc(x.formula||'—')}</strong></div><div><small>PubChem CID</small><strong>${x.pubchemCid?esc(x.pubchemCid):'not resolved'}</strong></div><div><small>InChIKey</small><strong>${esc(x.inchikey||'not resolved')}</strong></div><div><small>Subclass</small><strong>${esc(x.subclass||'—')}</strong></div><div><small>Aliases</small><strong>${esc((x.aliases||[]).join(', ')||'—')}</strong></div><div><small>Aroma descriptors</small><strong>${esc((x.aromaDescriptors||[]).join(', ')||'Not yet curated')}</strong></div><div><small>Cannabis occurrence</small><strong>${esc(x.cannabisOccurrence||'—')}</strong></div><div><small>Evidence grade</small><strong>${esc(x.evidenceGrade||'—')}</strong></div><div><small>Identity status</small><strong>${esc(identityLabel)}</strong></div><div><small>Stereochemistry</small><strong>${esc(x.stereochemistry||'not resolved')}</strong></div><div><small>Isomer group</small><strong>${esc(x.isomerGroup||'—')}</strong></div></div><h3>Structure & identifiers</h3>${structureHtml}<h3>Chemical identity</h3>${identityHtml}<h3>Measured population context</h3>${measured}<h3>Mechanisms & evidence</h3><div class="mechanism-list">${mechanismHtml}</div><h3>Evidence sources</h3><div class="record-sources">${sourceHtml}</div>`;
  $('[data-download-compound]')?.addEventListener('click',()=>downloadCompoundRecord(x));
  const dialog=$('[data-compound-dialog]');
  if(typeof dialog.showModal==='function')dialog.showModal(); else dialog.setAttribute('open','');
}
function normalizeAnalyteLabel(label){
  const raw=String(label||'').trim(),key=raw.toLowerCase().replace(/\s+/g,' ');
  const row=(state.normalization?.aliases||[]).find(x=>String(x.reported||'').trim().toLowerCase().replace(/\s+/g,' ')===key);
  return row?{...row,reportedOriginal:raw}:null;
}
function resolveProfileMeasurement(row,known){
  const direct=row.compoundId?known.get(row.compoundId):null;
  if(direct)return{item:direct,mode:'direct-id',identityResolution:direct.identityStatus==='verified'?'resolved':direct.identityStatus==='unresolved'?'unresolved':'partial',reportedName:row.reportedName||row.analyte||row.compoundId};
  const reported=row.reportedName||row.analyte||row.name||row.compoundName||'';
  const norm=normalizeAnalyteLabel(reported);
  if(norm){const item=known.get(norm.normalized);return{item,mode:'normalized-name',identityResolution:norm.identityResolution||'partial',reportedName:reported,norm};}
  return{item:null,mode:'unmapped',identityResolution:'unresolved',reportedName:reported||row.compoundId||'unmapped analyte'};
}
function validateProfile(profile){
  const errors=[];
  for(const key of ['sampleId','displayName','source','matrix','method','unit','measurements']) if(profile?.[key]===undefined||profile?.[key]===null||profile?.[key]==='')errors.push(`Missing ${key}`);
  if(!Array.isArray(profile?.measurements)||profile.measurements.length===0)errors.push('measurements must be a non-empty array');
  for(const [index,row] of (profile?.measurements||[]).entries()){
    if(!row.compoundId&&!row.reportedName&&!row.analyte&&!row.name&&!row.compoundName)errors.push(`measurement ${index+1}: provide compoundId or reported analyte name`);
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
  const unit=String(profile.unit||'').trim(),canComparePopulation=unit.toLowerCase()==='ppm';
  status.innerHTML=`<strong>${esc(profile.displayName)}</strong><p>${esc(profile.sampleId)} · ${esc(profile.matrix)} · ${esc(profile.method)} · ${esc(profile.unit)}</p>`;
  const rows=profile.measurements.map(row=>{
    const resolved=resolveProfileMeasurement(row,known),item=resolved.item;
    const resultText=row.value!==undefined?`${esc(row.value)} ${esc(profile.unit)}`:esc(row.qualifier||'reported');
    const identityStatus=resolved.mode==='unmapped'?'unmapped analyte':resolved.identityResolution==='resolved'?'identity resolved':resolved.identityResolution==='unresolved'?'mapped · identity unresolved':resolved.mode==='normalized-name'?'normalized · identity partial':'mapped · identity review needed';
    const label=item?.canonicalName||resolved.reportedName||row.compoundId;
    const original=resolved.mode==='normalized-name'&&resolved.reportedName?`<br><small>reported as: ${esc(resolved.reportedName)}</small>`:'';
    let populationContext='No mapped population record.';
    if(!canComparePopulation) populationContext='Not compared: Atlas population data are ppm and this profile uses '+unit+'.';
    else if(item){
      const population=populationFor(item.id)[0];
      if(population){
        const max=`${population.maxQualifier||''}${Number(population.maxPpm).toLocaleString(undefined,{maximumFractionDigits:1})}`;
        populationContext=`n=${state.population.sampleCount} · mean ${Number(population.meanPpm).toLocaleString(undefined,{maximumFractionDigits:1})} ppm · range ${Number(population.minPpm).toLocaleString(undefined,{maximumFractionDigits:1})}–${max} · CV ${Number(population.cvPercent).toLocaleString(undefined,{maximumFractionDigits:1})}%`;
      }
    }
    return `<tr><td>${esc(label)}${original}</td><td>${resultText}</td><td>${esc(identityStatus)}</td><td>${esc(populationContext)}</td></tr>`;
  }).join('');
  result.innerHTML=`<h3>Measured sample</h3><p><strong>Source:</strong> ${esc(typeof profile.source==='string'?profile.source:JSON.stringify(profile.source))}</p><table><thead><tr><th>Compound</th><th>Result</th><th>Atlas status</th><th>Atlas population context</th></tr></thead><tbody>${rows}</tbody></table><p class="population-note">Population context is descriptive, not a cultivar target or acceptance range. This browser view never converts laboratory units: n=79 population statistics are shown only when the imported profile already reports ppm. Compare only compatible matrices, methods, units, and reporting conventions. Name normalization preserves the original reported analyte label and never infers unreported stereochemistry.</p>`;
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
  const a=$('[data-compare-a]'),b=$('[data-compare-b]');
  a.innerHTML=options;b.innerHTML=options;
  const params=new URLSearchParams(location.search),requestedA=params.get('compareA'),requestedB=params.get('compareB');
  a.value=state.catalog.compounds.some(x=>x.id===requestedA)?requestedA:(state.catalog.compounds[0]?.id||'');
  b.value=state.catalog.compounds.some(x=>x.id===requestedB)?requestedB:(state.catalog.compounds[1]?.id||a.value);
  if(a.value===b.value&&state.catalog.compounds.length>1)b.value=state.catalog.compounds.find(x=>x.id!==a.value)?.id||b.value;
}
function compareCard(x){
  const measured=populationFor(x.id),row=measured[0];
  const identity=({'verified':'verified structure','partially-resolved':'partial identity','unresolved':'unresolved identity','parent-concept':'parent concept'})[x.identityStatus]||'identity review pending';
  const sourceTitles=(x.evidence||[]).map(sourceFor).filter(Boolean).map(s=>s.title);
  const population=row?`${Number(row.meanPpm).toLocaleString(undefined,{maximumFractionDigits:1})} mean ppm · range ${Number(row.minPpm).toLocaleString(undefined,{maximumFractionDigits:1})}–${esc(row.maxQualifier||'')}${Number(row.maxPpm).toLocaleString(undefined,{maximumFractionDigits:1})} · CV ${Number(row.cvPercent).toLocaleString(undefined,{maximumFractionDigits:1})}% (n=${state.population.sampleCount})`:'No mapped quantitative population summary.';
  const authority=x.pubchemCid?`<a href="https://pubchem.ncbi.nlm.nih.gov/compound/${encodeURIComponent(x.pubchemCid)}" target="_blank" rel="noopener">PubChem CID ${esc(x.pubchemCid)}</a>`:'No PubChem CID assigned';
  return `<article class="compare-card"><h3>${esc(x.canonicalName)}</h3><dl><dt>Family</dt><dd>${esc(x.class)}</dd><dt>Subclass</dt><dd>${esc(x.subclass||'—')}</dd><dt>Formula</dt><dd>${esc(x.formula||'—')}</dd><dt>Identity</dt><dd>${esc(identity)} · ${authority}</dd><dt>Aroma</dt><dd>${esc((x.aromaDescriptors||[]).join(', ')||'—')}</dd><dt>Aliases</dt><dd>${esc((x.aliases||[]).join(', ')||'—')}</dd><dt>Cannabis</dt><dd>${esc(x.cannabisOccurrence||'—')}</dd><dt>Evidence grade</dt><dd>${esc(x.evidenceGrade||'—')}</dd><dt>Measured population</dt><dd>${population}</dd><dt>Sources</dt><dd>${esc(sourceTitles.join(' · ')||'No resolved source title.')}</dd></dl><p>${esc(x.notes||'')}</p><p class="evidence-limit"><strong>Interpretation:</strong> identity resolution and occurrence evidence are separate from evidence for biological or human effects.</p></article>`;
}
function syncCompareUrl(){
  const params=new URLSearchParams(location.search),a=$('[data-compare-a]')?.value,b=$('[data-compare-b]')?.value;
  if(a)params.set('compareA',a);else params.delete('compareA');
  if(b)params.set('compareB',b);else params.delete('compareB');
  const query=params.toString();
  history.replaceState(null,'',location.pathname+(query?'?'+query:'')+location.hash);
}
function renderCompare(){
  const a=state.catalog.compounds.find(x=>x.id===$('[data-compare-a]').value)||state.catalog.compounds[0];
  const b=state.catalog.compounds.find(x=>x.id===$('[data-compare-b]').value)||state.catalog.compounds[1]||a;
  $('[data-compare-grid]').innerHTML=[a,b].map(compareCard).join('');
}
$('[data-search]').addEventListener('input',e=>{state.query=e.target.value;render()});
$('[data-class-filter]').addEventListener('change',e=>{state.family=e.target.value;renderWheel();render()});
$('[data-scope-filter]').addEventListener('change',e=>{state.scope=e.target.value;render()});
$('[data-compare-a]').addEventListener('change',()=>{renderCompare();syncCompareUrl()});
$('[data-compare-b]').addEventListener('change',()=>{renderCompare();syncCompareUrl()});
$('[data-copy-compare]')?.addEventListener('click',async()=>{
  syncCompareUrl();
  const status=$('[data-compare-status]'),url=location.href;
  try{await navigator.clipboard.writeText(url);if(status)status.textContent='Comparison link copied.'}
  catch{if(status)status.textContent='Copy unavailable. Use the current page URL.'}
});
load().catch(error=>{$('[data-grid]').innerHTML=`<div class="empty">Terpene Atlas data could not load. ${esc(error.message)}</div>`;console.error('[Terpene Atlas]',error)});
function clearCompoundUrl(){
  const params=new URLSearchParams(location.search);
  params.delete('compound');
  const query=params.toString();
  history.replaceState(null,'',`${location.pathname}${query?'?'+query:''}${location.hash}`);
}
$('[data-dialog-close]')?.addEventListener('click',()=>{ $('[data-compound-dialog]')?.close(); clearCompoundUrl(); });
$('[data-compound-dialog]')?.addEventListener('click',e=>{if(e.target===e.currentTarget){e.currentTarget.close();clearCompoundUrl();}});
$('[data-compound-dialog]')?.addEventListener('close',clearCompoundUrl);
$('[data-profile-file]')?.addEventListener('change',async e=>{
  const file=e.target.files?.[0]; if(!file)return;
  try{const profile=JSON.parse(await file.text());renderImportedProfile(profile);}
  catch(error){$('[data-profile-status]').innerHTML=`<strong>Profile rejected</strong><p>Invalid JSON: ${esc(error.message)}</p>`; $('[data-profile-result]').hidden=true;}
});