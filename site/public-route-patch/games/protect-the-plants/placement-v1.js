(()=>{
  let syncQueued=false;
  let previewKey='';

  const selectedSpec=()=>{
    if(typeof FORMATIONS==='undefined'||typeof placement==='undefined')return null;
    return FORMATIONS.find(item=>item.id===placement.selected)||null;
  };

  const placementBoard=()=>document.querySelector('.board .cell[data-place]')?.closest('.board')||null;

  function proposedCells(row,col){
    const spec=selectedSpec();
    if(!spec)return[];
    const horizontal=Boolean(placement.horizontal);
    return Array.from({length:spec.size},(_,i)=>({
      row:row+(horizontal?0:i),
      col:col+(horizontal?i:0)
    }));
  }

  function proposalStatus(row,col){
    const spec=selectedSpec();
    if(!spec)return{valid:false,cells:[],reason:'Select a bud formation.'};
    const cells=proposedCells(row,col);
    if(cells.some(cell=>cell.row<0||cell.col<0||cell.row>=15||cell.col>=15)){
      return{valid:false,cells,reason:`${spec.name} runs off the grid here.`};
    }
    const occupied=new Set();
    for(const formation of placement.fleet||[]){
      if(formation.id===spec.id)continue;
      for(const cell of formation.cells||[])occupied.add(`${cell.row}:${cell.col}`);
    }
    if(cells.some(cell=>occupied.has(`${cell.row}:${cell.col}`))){
      return{valid:false,cells,reason:`${spec.name} overlaps another formation here.`};
    }
    return{valid:true,cells,reason:`Place ${spec.name} here.`};
  }

  function ensurePanel(board){
    const card=board.closest('.board-card')||board.parentElement;
    if(!card)return null;
    let panel=card.querySelector('.burn-placement-guide');
    if(panel)return panel;
    panel=document.createElement('section');
    panel.className='burn-placement-guide';
    panel.setAttribute('aria-live','polite');
    panel.innerHTML='<div class="burn-placement-copy"><span>STASH SETUP</span><strong>Choose a formation</strong><small>Place all five buds before locking your stash.</small></div><div class="burn-placement-progress" aria-label="Placement progress"></div>';
    const title=card.querySelector('.board-title');
    if(title)title.after(panel);else card.prepend(panel);
    return panel;
  }

  function renderGuide(){
    if(typeof state==='undefined'||state?.status!=='placement'||state.me?.ready)return;
    const board=placementBoard();
    if(!board)return;
    const panel=ensurePanel(board);
    if(!panel)return;
    const spec=selectedSpec();
    const placedIds=new Set((placement.fleet||[]).map(item=>item.id));
    const complete=typeof FORMATIONS!=='undefined'&&placedIds.size===FORMATIONS.length;
    const copy=panel.querySelector('.burn-placement-copy');
    if(copy){
      const orientation=placement.horizontal?'Horizontal':'Vertical';
      copy.querySelector('span').textContent=complete?'STASH READY':'STASH SETUP';
      copy.querySelector('strong').textContent=complete?'All five formations placed':`${spec?.name||'Formation'} · ${orientation}`;
      copy.querySelector('small').textContent=complete?'Review the grid, then lock your stash.':`${placedIds.size}/5 placed · tap a cell to position this ${spec?.size||0}-cell formation.`;
    }
    const progress=panel.querySelector('.burn-placement-progress');
    if(progress&&typeof FORMATIONS!=='undefined'){
      progress.innerHTML=FORMATIONS.map(item=>`<span class="${placedIds.has(item.id)?'done':''} ${item.id===placement.selected?'selected':''}" title="${item.name}">${placedIds.has(item.id)?'✓':'•'}<b>${item.size}</b></span>`).join('');
    }
    document.body.classList.toggle('burn-placement-complete',complete);
  }

  function clearPreview(board){
    if(!board)return;
    board.querySelectorAll('.cell.place-preview,.cell.place-invalid').forEach(cell=>cell.classList.remove('place-preview','place-invalid'));
    previewKey='';
  }

  function preview(cell){
    const board=placementBoard();
    if(!board||!cell)return;
    const raw=cell.dataset.place;
    if(!raw)return;
    const [row,col]=raw.split(',').map(Number);
    if(!Number.isInteger(row)||!Number.isInteger(col))return;
    const status=proposalStatus(row,col);
    const key=`${row}:${col}:${placement.selected}:${placement.horizontal?'h':'v'}`;
    if(key===previewKey)return;
    clearPreview(board);
    previewKey=key;
    for(const coord of status.cells){
      const target=board.querySelector(`.cell[data-place="${coord.row},${coord.col}"]`);
      if(target)target.classList.add(status.valid?'place-preview':'place-invalid');
    }
    const panel=ensurePanel(board);
    const detail=panel?.querySelector('.burn-placement-copy small');
    if(detail)detail.textContent=status.reason;
  }

  function sync(){
    renderGuide();
    const board=placementBoard();
    if(!board){
      document.body.classList.remove('burn-placement-complete');
      return;
    }
    const spec=selectedSpec();
    for(const cell of board.querySelectorAll('.cell[data-place]')){
      const [row,col]=cell.dataset.place.split(',').map(Number);
      const status=proposalStatus(row,col);
      cell.setAttribute('aria-label',`${cell.getAttribute('aria-label')||''}${spec?`, place ${spec.name} ${placement.horizontal?'horizontal':'vertical'}`:''}${status.valid?'':', invalid position'}`);
    }
  }

  function queueSync(){
    if(syncQueued)return;
    syncQueued=true;
    requestAnimationFrame(()=>{syncQueued=false;sync();});
  }

  const root=document.querySelector('#app');
  if(root){
    root.addEventListener('pointerover',event=>{
      const cell=event.target.closest?.('.cell[data-place]');
      if(cell&&event.pointerType!=='touch')preview(cell);
    });
    root.addEventListener('focusin',event=>{
      const cell=event.target.closest?.('.cell[data-place]');
      if(cell)preview(cell);
    });
    root.addEventListener('pointerleave',event=>{
      const board=event.target.closest?.('.board');
      if(board?.querySelector('.cell[data-place]'))clearPreview(board);
    },true);
    root.addEventListener('click',event=>{
      if(event.target.closest?.('[data-action="rotate"],[data-action="random"],[data-formation]'))requestAnimationFrame(queueSync);
    });
    new MutationObserver(queueSync).observe(root,{childList:true,subtree:true});
  }

  queueSync();
})();
