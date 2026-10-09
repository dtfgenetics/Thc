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
  const write=(state)=>{const next=normalize(state);try{localStorage.setItem(KEY,JSON.stringify(next));}catch(error){console.warn('Study progress cannot be saved on this device',error);}dispatchEvent(new CustomEvent('dtf-atlas-study-progress',{detail:next}));return next;};
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
        host.replaceChildren();
        const wrapper=document.createElement('div');
        wrapper.style.cssText='display:flex;gap:14px;align-items:center;justify-content:space-between;flex-wrap:wrap';
        const info=document.createElement('div');
        const label=document.createElement('small');
        label.style.cssText='text-transform:uppercase;letter-spacing:.1em;font-weight:900;color:#667269';
        label.textContent='Atlas study progress';
        const heading=document.createElement('strong');
        heading.style.cssText='display:block;margin-top:4px';
        heading.textContent=String(system.title||id);
        const status=document.createElement('span');
        status.style.color='#667269';
        status.textContent=complete?'Marked complete on this device.':'Visited; completion is still up to you.';
        info.append(label,heading,status);
        const actions=document.createElement('div');
        actions.style.cssText='display:flex;gap:8px;flex-wrap:wrap';
        const toggle=document.createElement('button');
        toggle.type='button';
        toggle.setAttribute('data-study-toggle','');
        toggle.setAttribute('aria-pressed',String(complete));
        toggle.style.cssText='min-height:44px;padding:9px 13px;border:1px solid #b9c8bc;border-radius:10px;background:'+(complete?'#dff0e3':'#eef3ee')+';font:inherit;font-weight:850;cursor:pointer';
        toggle.textContent=complete?'Completed ✓':'Mark system complete';
        const dashboard=document.createElement('a');
        dashboard.href='/atlas/study/';
        dashboard.textContent='Study dashboard';
        dashboard.style.cssText='display:inline-flex;align-items:center;min-height:44px;padding:9px 13px;border:1px solid #b9c8bc;border-radius:10px;background:#eef3ee;color:#16331f;text-decoration:none;font-weight:850';
        actions.append(toggle,dashboard);
        wrapper.append(info,actions);
        host.append(wrapper);
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