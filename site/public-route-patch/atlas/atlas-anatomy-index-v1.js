const root=document.querySelector('[data-anatomy-index]');
if(root){
  const search=root.querySelector('[data-anatomy-search]');
  const scale=root.querySelector('[data-anatomy-scale]');
  const representation=root.querySelector('[data-anatomy-representation]');
  const count=root.querySelector('[data-anatomy-count]');
  const grid=root.querySelector('[data-anatomy-grid]');
  const esc=(v='')=>String(v).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const labelFor=(value)=>({
    'direct-3d':'Direct 3D',
    'semantic-3d-anchor':'Semantic anchor',
    'micro-reference':'Microscopic reference',
    'whole-plant':'Whole plant',
    'organ-tissue':'Organ + tissue',
    'microscopic':'Microscopic'
  }[value]||value);
  const render=(items)=>{
    const q=(search.value||'').trim().toLowerCase();
    const wantedScale=scale.value;
    const wantedRep=representation.value;
    const visible=items.filter(item=>{
      const hay=[item.label,item.detail,item.copy,item.id,item.systemId,item.limitation,item.representation,item.scale].join(' ').toLowerCase();
      return (!q||hay.includes(q))&&(wantedScale==='all'||wantedScale===item.scale)&&(wantedRep==='all'||wantedRep===item.representation);
    });
    count.textContent=`${visible.length} of ${items.length} structures`;
    grid.innerHTML=visible.map(item=>`<article class="anatomy-index-card"><div class="anatomy-badges"><span class="anatomy-scale">${esc(labelFor(item.scale))}</span><span class="anatomy-representation ${esc(item.representation)}">${esc(labelFor(item.representation))}</span></div><h3>${esc(item.label)}</h3><p class="anatomy-detail">${esc(item.detail||'')}</p><p>${esc(item.copy||'')}</p><p class="anatomy-limitation"><strong>Representation:</strong> ${esc(item.limitation||'')}</p><div><button type="button" data-focus-id="${esc(item.id)}">${item.representation==='micro-reference'?'Locate tissue in 3D':'Focus in 3D'}</button><a href="${esc(item.route)}">Open system →</a></div></article>`).join('');
    for(const button of grid.querySelectorAll('[data-focus-id]')) button.addEventListener('click',()=>{
      const target=document.querySelector(`[data-plant-focus="${button.dataset.focusId}"]`);
      if(target){ target.click(); document.querySelector('#interactive-plant')?.scrollIntoView({behavior:'smooth',block:'start'}); return; }
      window.dispatchEvent(new CustomEvent('plant-atlas:focus',{detail:{id:button.dataset.focusId}}));
      document.querySelector('#interactive-plant')?.scrollIntoView({behavior:'smooth',block:'start'});
    });
  };
  Promise.all([
    fetch('/atlas/data/hotspots-v4.json',{cache:'no-store'}).then(r=>{if(!r.ok)throw new Error('hotspots '+r.status);return r.json()}),
    fetch('/atlas/data/anatomy-registry-v1.json',{cache:'no-store'}).then(r=>{if(!r.ok)throw new Error('registry '+r.status);return r.json()})
  ]).then(([hotspotData,registryData])=>{
    const hotspots=Array.isArray(hotspotData.hotspots)?hotspotData.hotspots:[];
    const registry=Array.isArray(registryData.structures)?registryData.structures:[];
    const byId=new Map(registry.map(x=>[x.id,x]));
    const items=hotspots.map(h=>({...h,...(byId.get(h.id)||{})}));
    render(items);
    search.addEventListener('input',()=>render(items));
    scale.addEventListener('change',()=>render(items));
    representation.addEventListener('change',()=>render(items));
  }).catch(error=>{
    grid.innerHTML=`<p class="error">Anatomy index could not load (${esc(error.message)}). The 3D viewer and system library remain available.</p>`;
  });
}