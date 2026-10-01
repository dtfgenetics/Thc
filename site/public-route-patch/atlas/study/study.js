(() => {
 const KEY='dtf.atlas.study-progress.v1'; const root=document.querySelector('[data-paths-root]');
 const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
 const read=()=>{try{const x=JSON.parse(localStorage.getItem(KEY)||'{}');return{visited:[...new Set(Array.isArray(x.visited)?x.visited:[])],completed:[...new Set(Array.isArray(x.completed)?x.completed:[])]};}catch{return{visited:[],completed:[]};}};
 async function render(){
  const [systemsRes,pathsRes]=await Promise.all([fetch('/atlas/data/systems.json',{cache:'no-store'}),fetch('/atlas/data/study-paths-v1.json',{cache:'no-store'})]);
  if(!systemsRes.ok||!pathsRes.ok)throw new Error('Study data unavailable');
  const systems=(await systemsRes.json()).systems||[], config=await pathsRes.json(), byId=new Map(systems.map(s=>[s.id,s])), state=read(), complete=new Set(state.completed), visited=new Set(state.visited);
  document.querySelector('[data-visited]').textContent=visited.size; document.querySelector('[data-completed]').textContent=complete.size;
  const finished=(config.paths||[]).filter(p=>p.systems.every(id=>complete.has(id))).length; document.querySelector('[data-paths]').textContent=finished;
  root.innerHTML=(config.paths||[]).map(p=>{const done=p.systems.filter(id=>complete.has(id)).length,pct=Math.round(done/p.systems.length*100);return '<article class="path"><small>'+done+'/'+p.systems.length+' systems complete</small><h2>'+esc(p.title)+'</h2><p>'+esc(p.summary)+'</p><div class="track" role="progressbar" aria-valuemin="0" aria-valuemax="'+p.systems.length+'" aria-valuenow="'+done+'"><span style="width:'+pct+'%"></span></div><div class="systems">'+p.systems.map(id=>{const s=byId.get(id);if(!s)return'';const cls=complete.has(id)?'done':visited.has(id)?'visited':'';return '<a class="system '+cls+'" href="'+esc(s.route)+'"><span><strong>'+esc(s.title)+'</strong><br><small>'+esc(s.category)+'</small></span><b>'+(complete.has(id)?'Complete ✓':visited.has(id)?'Visited':'Open')+'</b></a>';}).join('')+'</div><p><strong>Outcome:</strong> '+esc(p.outcome)+'</p></article>';}).join('');
 }
 document.querySelector('[data-export]').addEventListener('click',()=>{const payload={format:'DTF Atlas Study Progress',version:1,exportedAt:new Date().toISOString(),...read()};const blob=new Blob([JSON.stringify(payload,null,2)],{type:'application/json'}),url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download='dtf-atlas-study-progress-'+new Date().toISOString().slice(0,10)+'.json';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);});
 document.querySelector('[data-reset]').addEventListener('click',()=>{if(confirm('Reset all local Atlas study progress on this device?')){localStorage.removeItem(KEY);render();}});
 addEventListener('storage',render); render().catch(err=>{root.innerHTML='<div class="empty">Study dashboard could not load. '+esc(err.message)+'</div>';});
})();