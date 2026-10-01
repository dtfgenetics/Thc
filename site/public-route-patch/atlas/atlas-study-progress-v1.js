(() => {
  const KEY='dtf.atlas.study-progress.v1';
  const SYSTEMS_URL='/atlas/data/systems.json';
  const normalize=(value)=>{
    const empty={version:1,visited:[],completed:[]};
    if(!value||typeof value!=='object')return empty;
    const unique=(items)=>[...new Set(Array.isArray(items)?items.filter(x=>typeof x==='string'):[])];
    return {version:1,visited:unique(value.visited),completed:unique(value.completed)};
  };
  const read=()=>{try{return normalize(JSON.parse(localStorage.getItem(KEY)||'{}'));}catch{return normalize(null);}};
  const write=(state)=>{const next=normalize(state);localStorage.setItem(KEY,JSON.stringify(next));dispatchEvent(new CustomEvent('dtf-atlas-study-progress',{detail:next}));return next;};
  const slug=()=>location.pathname.split('/').filter(Boolean)[1]||'';
  async function boot(){
    try{
      const response=await fetch(SYSTEMS_URL,{cache:'no-store'});
      if(!response.ok)return;
      const data=await response.json();
      const systems=Array.isArray(data.systems)?data.systems:[];
      const id=slug();
      const system=systems.find(item=>item.id===id);
      if(!system)return;
      const current=read();
      if(!current.visited.includes(id))write({...current,visited:[...current.visited,id]});
      const host=document.createElement('section');
      host.setAttribute('data-atlas-study-progress','');
      host.style.cssText='margin:24px auto;max-width:1180px;padding:16px 18px;border:1px solid #d7dfd8;border-radius:14px;background:#fffdf8;color:#16331f;font-family:system-ui,-apple-system,Segoe UI,Roboto,Arial,sans-serif';
      const render=()=>{
        const state=read();
        const complete=state.completed.includes(id);
        host.innerHTML='<div style="display:flex;gap:14px;align-items:center;justify-content:space-between;flex-wrap:wrap"><div><small style="text-transform:uppercase;letter-spacing:.1em;font-weight:900;color:#667269">Atlas study progress</small><strong style="display:block;margin-top:4px">'+system.title+'</strong><span style="color:#667269">'+(complete?'Marked complete on this device.':'Visited; completion is still up to you.')+'</span></div><div style="display:flex;gap:8px;flex-wrap:wrap"><button type="button" data-study-toggle style="min-height:42px;padding:9px 13px;border:1px solid #b9c8bc;border-radius:10px;background:'+(complete?'#dff0e3':'#eef3ee')+';font:inherit;font-weight:850;cursor:pointer">'+(complete?'Completed ✓':'Mark system complete')+'</button><a href="/atlas/study/" style="display:inline-flex;align-items:center;min-height:42px;padding:9px 13px;border:1px solid #b9c8bc;border-radius:10px;background:#eef3ee;color:#16331f;text-decoration:none;font-weight:850">Study dashboard</a></div></div>';
        host.querySelector('[data-study-toggle]')?.addEventListener('click',()=>{
          const latest=read();
          const set=new Set(latest.completed);
          if(set.has(id))set.delete(id);else set.add(id);
          write({...latest,completed:[...set]});
          render();
        });
      };
      render();
      const footer=document.querySelector('footer');
      if(footer)footer.before(host);else document.body.append(host);
    }catch(error){console.warn('Atlas study progress unavailable',error);}
  }
  boot();
})();