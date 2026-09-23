const root=document.querySelector('[data-anatomy-index]');
if(root){
  const search=root.querySelector('[data-anatomy-search]');
  const scale=root.querySelector('[data-anatomy-scale]');
  const count=root.querySelector('[data-anatomy-count]');
  const grid=root.querySelector('[data-anatomy-grid]');
  const scaleFor=(id)=>{
    if(/trichome|stomatal|ovary|stigma/.test(id)) return 'microscopic';
    if(/leaf|petiole|bract|flower|preflower|root-tip|fine-roots|axillary|xylem|phloem/.test(id)) return 'organ-tissue';
    return 'whole-plant';
  };
  const render=(items)=>{
    const q=(search.value||'').trim().toLowerCase();
    const wanted=scale.value;
    const visible=items.filter(item=>{
      const itemScale=scaleFor(item.id);
      const hay=[item.label,item.detail,item.copy,item.id].join(' ').toLowerCase();
      return (!q||hay.includes(q))&&(wanted==='all'||wanted===itemScale);
    });
    count.textContent=`${visible.length} of ${items.length} structures`;
    grid.innerHTML=visible.map(item=>`<article class="anatomy-index-card"><span class="anatomy-scale">${scaleFor(item.id).replace('-', ' + ')}</span><h3>${item.label}</h3><p class="anatomy-detail">${item.detail||''}</p><p>${item.copy||''}</p><div><button type="button" data-focus-id="${item.id}">Focus in 3D</button><a href="${item.route}">Open system →</a></div></article>`).join('');
    for(const button of grid.querySelectorAll('[data-focus-id]')) button.addEventListener('click',()=>{
      const target=document.querySelector(`[data-plant-focus="${button.dataset.focusId}"]`);
      if(target){ target.click(); document.querySelector('#interactive-plant')?.scrollIntoView({behavior:'smooth',block:'start'}); return; }
      window.dispatchEvent(new CustomEvent('plant-atlas:focus',{detail:{id:button.dataset.focusId}}));
      document.querySelector('#interactive-plant')?.scrollIntoView({behavior:'smooth',block:'start'});
    });
  };
  fetch('/atlas/data/hotspots-v4.json',{cache:'no-store'}).then(r=>{if(!r.ok)throw new Error(String(r.status));return r.json()}).then(data=>{
    const items=Array.isArray(data.hotspots)?data.hotspots:[];
    render(items);
    search.addEventListener('input',()=>render(items));
    scale.addEventListener('change',()=>render(items));
  }).catch(error=>{
    grid.innerHTML=`<p class="error">Anatomy index could not load (${error.message}). The 3D viewer and system library remain available.</p>`;
  });
}