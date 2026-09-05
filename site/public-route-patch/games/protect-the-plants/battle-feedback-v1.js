(()=>{
  let queued=false;
  let lastEventKey='';

  const coord=(row,col)=>`${String.fromCharCode(65+Number(row))}${Number(col)+1}`;

  function cardByTitle(title){
    return [...document.querySelectorAll('.board-card')].find(card=>
      card.querySelector('.board-title h3')?.textContent?.trim()===title
    )||null;
  }

  function markLatestShot(){
    document.querySelectorAll('.cell.burn-latest-shot,.cell.burn-latest-hit,.cell.burn-latest-miss').forEach(cell=>{
      cell.classList.remove('burn-latest-shot','burn-latest-hit','burn-latest-miss');
    });

    if(typeof state==='undefined'||!state||!state.lastEvent||state.lastEvent.type!=='scout')return;
    const event=state.lastEvent;
    const key=event.id||`${event.byPlayerId}:${event.row}:${event.col}:${event.hit}`;
    const mine=event.byPlayerId===state.me?.id;
    const card=cardByTitle(mine?'Fire on Opponent':'Your Stash');
    if(!card)return;
    const label=coord(event.row,event.col);
    const cell=[...card.querySelectorAll('.cell')].find(node=>node.getAttribute('aria-label')?.startsWith(label));
    if(!cell)return;

    cell.classList.add('burn-latest-shot',event.hit?'burn-latest-hit':'burn-latest-miss');
    if(key!==lastEventKey){
      lastEventKey=key;
      cell.classList.remove('burn-shot-pop');
      void cell.offsetWidth;
      cell.classList.add('burn-shot-pop');
      setTimeout(()=>cell.classList.remove('burn-shot-pop'),700);
    }
  }

  function markPrimaryBoard(){
    const mine=Boolean(typeof state!=='undefined'&&state?.status==='playing'&&state.turnPlayerId===state.me?.id);
    const own=cardByTitle('Your Stash');
    const enemy=cardByTitle('Fire on Opponent');
    own?.classList.toggle('burn-primary-board',!mine);
    enemy?.classList.toggle('burn-primary-board',mine);
    own?.classList.toggle('burn-secondary-board',mine);
    enemy?.classList.toggle('burn-secondary-board',!mine);
  }

  function improveCellSemantics(){
    document.querySelectorAll('.board .cell').forEach(cell=>{
      cell.classList.toggle('burn-hit-cell',cell.classList.contains('hit'));
      cell.classList.toggle('burn-miss-cell',cell.classList.contains('miss'));
      if(cell.classList.contains('hit'))cell.dataset.result='hit';
      else if(cell.classList.contains('miss'))cell.dataset.result='miss';
      else delete cell.dataset.result;
    });
  }

  function sync(){
    queued=false;
    markPrimaryBoard();
    improveCellSemantics();
    markLatestShot();
  }

  function queue(){
    if(queued)return;
    queued=true;
    requestAnimationFrame(sync);
  }

  if(window.BurnBudsSync)window.BurnBudsSync.subscribe(queue);else queue();
})();
