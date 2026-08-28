(()=>{
  const GRID_SIZE=15;
  let syncQueued=false;
  let activeCoord='';

  function coordinate(row,col){
    return `${String.fromCharCode(65+Number(row))}${Number(col)+1}`;
  }

  function parseCell(cell){
    const raw=cell?.dataset?.fire;
    if(!raw)return null;
    const [row,col]=raw.split(',').map(Number);
    if(!Number.isInteger(row)||!Number.isInteger(col))return null;
    return{row,col,coord:coordinate(row,col)};
  }

  function enemyCard(){
    return [...document.querySelectorAll('.board-card')].find(card=>
      card.querySelector('.board-title h3')?.textContent?.trim()==='Fire on Opponent'
    )||null;
  }

  function ensureReadout(card){
    let node=card.querySelector('.burn-target-readout');
    if(node)return node;
    node=document.createElement('div');
    node.className='burn-target-readout';
    node.setAttribute('role','status');
    node.setAttribute('aria-live','polite');
    node.setAttribute('aria-atomic','true');
    node.innerHTML='<span>TARGET</span><strong>—</strong><small>Select an open cell.</small>';
    card.querySelector('.board-title')?.after(node);
    return node;
  }

  function setReadout(card,label,value,detail){
    const node=ensureReadout(card);
    const labelNode=node.querySelector('span');
    const valueNode=node.querySelector('strong');
    const detailNode=node.querySelector('small');
    if(labelNode&&labelNode.textContent!==label)labelNode.textContent=label;
    if(valueNode&&valueNode.textContent!==value)valueNode.textContent=value;
    if(detailNode&&detailNode.textContent!==detail)detailNode.textContent=detail;
  }

  function isMyTurn(){
    return Boolean(typeof state!=='undefined'&&state?.status==='playing'&&state.turnPlayerId===state.me?.id);
  }

  function cellStatus(cell){
    if(cell.classList.contains('hit'))return'HIT';
    if(cell.classList.contains('miss'))return'MISS';
    if(cell.classList.contains('can-fire')&&isMyTurn())return'AVAILABLE';
    return'LOCKED';
  }

  function describeCell(card,cell){
    const parsed=parseCell(cell);
    if(!parsed)return;
    const status=cellStatus(cell);
    activeCoord=parsed.coord;
    card.querySelectorAll('.cell.target-preview').forEach(other=>{
      if(other!==cell)other.classList.remove('target-preview');
    });
    cell.classList.add('target-preview');

    if(status==='AVAILABLE'){
      setReadout(card,'TARGET',parsed.coord,'Ready to fire · click/tap or press Enter/Space.');
    }else if(status==='HIT'){
      setReadout(card,'RESULT',parsed.coord,'Already fired here · HIT.');
    }else if(status==='MISS'){
      setReadout(card,'RESULT',parsed.coord,'Already fired here · MISS.');
    }else{
      setReadout(card,'LOCKED',parsed.coord,'Targeting is locked until your turn.');
    }
  }

  function defaultReadout(card){
    if(typeof state==='undefined'||!state){
      setReadout(card,'TARGET','—','Join a room to begin targeting.');
      return;
    }
    if(state.status==='playing'&&isMyTurn()){
      setReadout(card,'YOUR TURN','Choose target','Pointer: hover/tap · Keyboard: arrows, then Enter/Space.');
      return;
    }
    if(state.status==='playing'){
      const event=state.lastEvent;
      if(event?.type==='scout'){
        const coord=coordinate(event.row,event.col);
        const mine=event.byPlayerId===state.me?.id;
        setReadout(card,mine?'LAST SHOT':'INCOMING',coord,`${event.hit?'HIT':'MISS'} · ${mine?'Opponent is responding.':'Your turn is next.'}`);
      }else{
        setReadout(card,'OPPONENT TURN','Targeting locked','Watch the Burn Log while your opponent fires.');
      }
      return;
    }
    if(state.status==='finished'){
      setReadout(card,'ROUND COMPLETE','—','Use the result controls to rematch or return to the lobby.');
      return;
    }
    setReadout(card,'TARGET','—','Targeting unlocks when the battle begins.');
  }

  function availableCells(card){
    return [...card.querySelectorAll('.cell[data-fire]')].filter(cell=>cell.classList.contains('can-fire'));
  }

  function syncGrid(){
    const card=enemyCard();
    if(!card)return;
    const cells=[...card.querySelectorAll('.cell[data-fire]')];
    const available=availableCells(card);

    for(const cell of cells){
      const parsed=parseCell(cell);
      if(!parsed)continue;
      const status=cellStatus(cell);
      const canFire=status==='AVAILABLE';
      cell.setAttribute('aria-label',`${parsed.coord}, ${status.toLowerCase()}`);
      cell.setAttribute('aria-disabled',String(!canFire));
      cell.setAttribute('aria-keyshortcuts','ArrowUp ArrowDown ArrowLeft ArrowRight Enter Space');
      cell.tabIndex=-1;
    }

    let preferred=available.find(cell=>parseCell(cell)?.coord===activeCoord);
    if(!preferred&&available.includes(document.activeElement))preferred=document.activeElement;
    if(!preferred)preferred=available[0]||null;
    if(preferred)preferred.tabIndex=0;

    const active=document.activeElement;
    if(active instanceof HTMLElement&&card.contains(active)&&active.matches('.cell[data-fire]')){
      describeCell(card,active);
    }else{
      card.querySelectorAll('.cell.target-preview').forEach(cell=>cell.classList.remove('target-preview'));
      defaultReadout(card);
    }
  }

  function queueSync(){
    if(syncQueued)return;
    syncQueued=true;
    requestAnimationFrame(()=>{
      syncQueued=false;
      syncGrid();
    });
  }

  function findDirectionalTarget(card,current,key){
    const parsed=parseCell(current);
    if(!parsed)return null;
    const delta={ArrowUp:[-1,0],ArrowDown:[1,0],ArrowLeft:[0,-1],ArrowRight:[0,1]}[key];
    if(!delta)return null;
    let row=parsed.row+delta[0];
    let col=parsed.col+delta[1];
    while(row>=0&&row<GRID_SIZE&&col>=0&&col<GRID_SIZE){
      const candidate=card.querySelector(`.cell[data-fire="${row},${col}"]`);
      if(candidate?.classList.contains('can-fire'))return candidate;
      row+=delta[0];
      col+=delta[1];
    }
    return null;
  }

  document.addEventListener('keydown',event=>{
    if(!['ArrowUp','ArrowDown','ArrowLeft','ArrowRight'].includes(event.key))return;
    const cell=event.target.closest?.('.board-card .cell[data-fire]');
    if(!cell)return;
    const card=enemyCard();
    if(!card||!card.contains(cell))return;
    const next=findDirectionalTarget(card,cell,event.key);
    if(!next)return;
    event.preventDefault();
    availableCells(card).forEach(item=>item.tabIndex=-1);
    next.tabIndex=0;
    next.focus();
    describeCell(card,next);
  });

  document.addEventListener('focusin',event=>{
    const cell=event.target.closest?.('.cell[data-fire]');
    const card=enemyCard();
    if(cell&&card?.contains(cell))describeCell(card,cell);
  });

  document.addEventListener('mouseover',event=>{
    const cell=event.target.closest?.('.cell[data-fire]');
    const card=enemyCard();
    if(cell&&card?.contains(cell))describeCell(card,cell);
  });

  const root=document.querySelector('#app');
  if(root)new MutationObserver(queueSync).observe(root,{childList:true,subtree:true});
  document.addEventListener('visibilitychange',()=>{if(!document.hidden)queueSync()});
  window.addEventListener('online',queueSync);
  queueSync();
})();
