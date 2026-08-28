(()=>{
  let lastEventId='';
  let lastTurnKey='';
  let lastStatus='';
  let initialized=false;
  let syncQueued=false;

  function ensureAnnouncer(){
    let node=document.querySelector('.burn-live-announcer');
    if(node)return node;
    node=document.createElement('div');
    node.className='burn-live-announcer';
    node.setAttribute('role','status');
    node.setAttribute('aria-live','polite');
    node.setAttribute('aria-atomic','true');
    document.body.appendChild(node);
    return node;
  }

  function publish(messages){
    const text=[...new Set(messages.filter(Boolean))].join(' ');
    if(!text)return;
    const node=ensureAnnouncer();
    node.textContent='';
    requestAnimationFrame(()=>{node.textContent=text});
  }

  function publicEventMessage(event){
    if(!event||!['scout','formation-lost','game-finished'].includes(event.type))return'';
    if(typeof eventText==='function')return eventText(event);
    const mine=event.byPlayerId===state?.me?.id;
    if(event.type==='scout'){
      const cell=`${String.fromCharCode(65+Number(event.row||0))}${Number(event.col||0)+1}`;
      return `${mine?'You':'Opponent'} fired on ${cell}: ${event.hit?'hit':'miss'}.`;
    }
    if(event.type==='formation-lost'){
      const spec=typeof FORMATIONS!=='undefined'?FORMATIONS.find(item=>item.id===event.formationId):null;
      return `${mine?'You':'Opponent'} burned ${spec?.name||'a full bud formation'}.`;
    }
    return mine?'Round won. You burned the final opponent formation.':'Round lost. Your final formation was burned.';
  }

  function turnMessage(){
    if(typeof state==='undefined'||!state)return'';
    if(state.status==='playing'){
      return state.turnPlayerId===state.me?.id
        ?'Your turn. Pick a cell and fire.'
        :'Opponent turn. Your stash is under fire.';
    }
    if(state.status==='placement')return state.me?.ready?'Your stash is locked. Waiting for the opponent.':'Set your stash. Place all five formations, then lock in.';
    if(state.status==='waiting')return'Waiting for an opponent to join.';
    if(state.status==='finished')return state.winnerId===state.me?.id?'Round won.':'Round lost.';
    return'';
  }

  function syncAnnouncements(){
    if(typeof state==='undefined'||!state)return;
    const messages=[];
    const event=state.lastEvent;

    if(!initialized){
      lastEventId=event?.id||'';
      initialized=true;
    }else if(event?.id&&event.id!==lastEventId){
      lastEventId=event.id;
      messages.push(publicEventMessage(event));
    }

    const turnKey=state.status==='playing'?`${state.status}:${state.turnPlayerId||''}`:`${state.status}:${Boolean(state.me?.ready)}`;
    if(turnKey!==lastTurnKey){
      lastTurnKey=turnKey;
      messages.push(turnMessage());
    }

    if(state.status!==lastStatus){
      const previous=lastStatus;
      lastStatus=state.status;
      if(state.status==='finished'&&previous&&event?.type!=='game-finished')messages.push(turnMessage());
    }

    publish(messages);
  }

  function queueSync(){
    if(syncQueued)return;
    syncQueued=true;
    requestAnimationFrame(()=>{
      syncQueued=false;
      syncAnnouncements();
    });
  }

  const root=document.querySelector('#app');
  if(root)new MutationObserver(queueSync).observe(root,{childList:true,subtree:true});
  window.addEventListener('online',queueSync);
  document.addEventListener('visibilitychange',()=>{if(!document.hidden)queueSync()});
  ensureAnnouncer();
  queueSync();
})();
