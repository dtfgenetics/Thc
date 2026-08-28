(()=>{
  let presenceTimer=null;
  let lastPresence=null;
  let enhanceQueued=false;
  let lastBurnEventId='';

  const normalizeText=value=>String(value||'')
    .replace('created the garden.','created the Burn Buds room.')
    .replace('joined the garden.','joined the Burn Buds room.')
    .replace('locked their garden.','locked their stash.')
    .replace('Both gardens are locked.','Both stashes are locked.')
    .replace('found an entire plant formation.','burned a full bud formation.')
    .replace('protected their garden and won round','burned every opposing bud and won round')
    .replace('All plant formations are required.','All bud formations are required.')
    .replace('Invalid plant formation.','Invalid bud formation.')
    .replace('Formation is outside the garden.','Formation is outside the stash grid.')
    .replace('Plant formations cannot overlap.','Bud formations cannot overlap.')
    .replace('This garden already has two players.','This room already has two players.')
    .replace('Plot is outside the garden.','Target is outside the battle grid.')
    .replace('You already scouted that plot.','You already fired at that cell.');

  function ensureBurnFx(){
    const overlay=document.querySelector('#plantOverlay');
    if(!overlay)return;
    let burst=overlay.querySelector('.burn-burst');
    if(!burst){
      burst=document.createElement('div');
      burst.className='burn-burst';
      burst.setAttribute('aria-hidden','true');
      burst.innerHTML=Array.from({length:10},(_,i)=>`<span style="--i:${i}"></span>`).join('');
      overlay.appendChild(burst);
    }
    if(!document.querySelector('#burnShock')){
      const shock=document.createElement('div');
      shock.id='burnShock';
      shock.className='burn-screen-shock';
      shock.setAttribute('aria-hidden','true');
      document.body.appendChild(shock);
    }
  }

  function triggerBurnFx(event){
    if(!event||event.id===lastBurnEventId)return;
    lastBurnEventId=event.id||'';
    ensureBurnFx();
    const spec=FORMATIONS.find(item=>item.id===event.formationId);
    const title=document.querySelector('.plant-loss-title');
    if(title)title.textContent=`${(spec?.name||'Bud Formation').toUpperCase()} BURNED!`;
    const shock=document.querySelector('#burnShock');
    if(shock){
      shock.classList.remove('show');
      void shock.offsetWidth;
      shock.classList.add('show');
      setTimeout(()=>shock.classList.remove('show'),850);
    }
    document.body.classList.remove('burn-impacting');
    void document.body.offsetWidth;
    document.body.classList.add('burn-impacting');
    setTimeout(()=>document.body.classList.remove('burn-impacting'),760);
  }

  function rewriteSystemCopy(){
    document.querySelectorAll('.msg.system').forEach(node=>{
      const next=normalizeText(node.textContent);
      if(next!==node.textContent)node.textContent=next;
    });
  }

  function formatLastSeen(seenAt){
    if(!seenAt)return'Not connected yet';
    const seconds=Math.max(0,Math.round((Date.now()-Number(seenAt))/1000));
    if(seconds<10)return'Active seconds ago';
    if(seconds<60)return`Last seen ${seconds}s ago`;
    const minutes=Math.round(seconds/60);
    return`Last seen ${minutes}m ago`;
  }

  function presenceMarkup(){
    if(!lastPresence?.opponent)return'<span class="burn-presence waiting"><i></i>Waiting</span>';
    return lastPresence.opponent.online
      ?'<span class="burn-presence online"><i></i>Live</span>'
      :`<span class="burn-presence away" title="${esc(formatLastSeen(lastPresence.opponent.lastSeenAt))}"><i></i>Reconnecting</span>`;
  }

  function updateSlot(slot,html){
    if(slot.innerHTML!==html)slot.innerHTML=html;
  }

  function renderPresence(){
    const html=presenceMarkup();
    const opponentHud=document.querySelector('.opponent-hud');
    if(opponentHud){
      let slot=opponentHud.querySelector('.burn-presence-slot');
      if(!slot){slot=document.createElement('span');slot.className='burn-presence-slot';opponentHud.appendChild(slot)}
      updateSlot(slot,html);
    }
    const active=document.querySelector('.active-card .active-meta');
    if(active){
      let slot=active.querySelector('.burn-presence-slot');
      if(!slot){slot=document.createElement('span');slot.className='burn-presence-slot';active.appendChild(slot)}
      updateSlot(slot,html);
    }
  }

  async function fetchPresence(){
    if(typeof identity==='undefined'||!identity?.playerId||!identity?.token||!identity?.code)return;
    try{
      const query=new URLSearchParams({code:identity.code});
      const response=await fetch(`./presence.php?${query}`,{
        headers:{'X-Player-Id':identity.playerId,'X-Player-Token':identity.token},
        cache:'no-store'
      });
      if(!response.ok)return;
      lastPresence=await response.json();
      renderPresence();
    }catch{}
  }

  function restartPresencePolling(){
    if(presenceTimer)clearInterval(presenceTimer);
    fetchPresence();
    presenceTimer=setInterval(fetchPresence,document.hidden?12000:5000);
  }

  function setTurnBanner(banner,className,html){
    if(banner.className!==className)banner.className=className;
    if(banner.innerHTML!==html)banner.innerHTML=html;
  }

  function applyTurnState(){
    const mine=Boolean(typeof state!=='undefined'&&state?.status==='playing'&&state.turnPlayerId===state.me?.id);
    const theirs=Boolean(typeof state!=='undefined'&&state?.status==='playing'&&state.turnPlayerId!==state.me?.id);
    document.body.classList.toggle('burn-my-turn',mine);
    document.body.classList.toggle('burn-opponent-turn',theirs);
    const playZone=document.querySelector('.play-zone');
    if(!playZone)return;
    let banner=playZone.querySelector('.burn-turn-banner');
    if(!banner){banner=document.createElement('div');banner.className='burn-turn-banner';playZone.prepend(banner)}
    if(typeof state==='undefined'||!state){banner.remove();return}
    if(state.status==='playing'){
      if(mine)setTurnBanner(banner,'burn-turn-banner fire','<strong>YOUR TURN</strong><span>Pick a cell and fire.</span>');
      else setTurnBanner(banner,'burn-turn-banner hold','<strong>OPPONENT TURN</strong><span>Your stash is under fire.</span>');
    }else if(state.status==='placement'){
      setTurnBanner(banner,'burn-turn-banner setup','<strong>SET YOUR STASH</strong><span>Place all five formations, then lock in.</span>');
    }else banner.remove();
  }

  function shotStats(shots){
    const list=Array.isArray(shots)?shots:[];
    const hits=list.filter(shot=>Boolean(shot?.hit)).length;
    return{shots:list.length,hits,accuracy:list.length?Math.round(hits/list.length*100):0};
  }

  function formationIsBurned(formation,shotsReceived){
    if(!formation||!Array.isArray(formation.cells)||!formation.cells.length)return false;
    const hitCells=new Set((Array.isArray(shotsReceived)?shotsReceived:[])
      .filter(shot=>shot?.hit)
      .map(shot=>`${shot.row}:${shot.col}`));
    return formation.cells.every(cell=>hitCells.has(`${cell.row}:${cell.col}`));
  }

  function remainingOwnFormations(){
    if(typeof state==='undefined'||!state?.me)return 5;
    const fleet=Array.isArray(state.me.fleet)?state.me.fleet:[];
    const burned=fleet.filter(formation=>formationIsBurned(formation,state.me.shotsReceived)).length;
    return Math.max(0,5-burned);
  }

  function remainingOpponentFormations(){
    if(typeof state==='undefined'||!state?.opponent)return 5;
    const revealedBurned=Array.isArray(state.opponent.fleet)?state.opponent.fleet.length:0;
    return state.status==='finished'&&state.winnerId!==state.me?.id
      ?Math.max(0,5-revealedBurned)
      :Math.max(0,5-revealedBurned);
  }

  function renderTelemetry(){
    const playZone=document.querySelector('.play-zone');
    if(!playZone)return;
    let strip=playZone.querySelector('.burn-telemetry');
    if(typeof state==='undefined'||!state||!['playing','finished'].includes(state.status)){
      if(strip)strip.remove();
      return;
    }
    if(!strip){
      strip=document.createElement('div');
      strip.className='burn-telemetry';
      strip.setAttribute('aria-label','Live battle statistics');
      const banner=playZone.querySelector('.burn-turn-banner');
      if(banner)banner.after(strip);else playZone.prepend(strip);
    }
    const mine=shotStats(state.me?.shots);
    const theirs=shotStats(state.opponent?.shots);
    const html=`<section><span class="burn-telemetry-label">YOU</span><strong>${remainingOwnFormations()}</strong><small>buds left</small><b>${mine.hits}/${mine.shots}</b><small>${mine.accuracy}% accuracy</small></section><i aria-hidden="true">VS</i><section><span class="burn-telemetry-label">OPPONENT</span><strong>${remainingOpponentFormations()}</strong><small>buds left</small><b>${theirs.hits}/${theirs.shots}</b><small>${theirs.accuracy}% accuracy</small></section>`;
    updateSlot(strip,html);
  }

  function staggerBurnedFormation(){
    document.querySelectorAll('.cell.lost .plant-token').forEach(token=>{
      const segment=Number(token.dataset.segment||0);
      const delay=`${Math.min(segment,5)*85}ms`;
      if(token.style.getPropertyValue('--burn-delay')!==delay)token.style.setProperty('--burn-delay',delay);
    });
  }

  function enhance(){
    rewriteSystemCopy();
    renderPresence();
    applyTurnState();
    renderTelemetry();
    staggerBurnedFormation();
    ensureBurnFx();
  }

  if(typeof showLoss==='function'&&!showLoss.__burnBudsV3){
    const originalShowLoss=showLoss;
    const wrapped=function(event){triggerBurnFx(event);return originalShowLoss(event)};
    wrapped.__burnBudsV3=true;
    showLoss=wrapped;
  }

  if(typeof api==='function'&&!api.__burnBudsV3){
    const previousApi=api;
    const wrapped=async function(action,options={}){
      try{return await previousApi(action,options)}
      catch(error){if(error?.message)error.message=normalizeText(error.message);throw error}
    };
    wrapped.__burnBudsV3=true;
    api=wrapped;
  }

  const root=document.querySelector('#app');
  if(root)new MutationObserver(()=>{
    if(enhanceQueued)return;
    enhanceQueued=true;
    requestAnimationFrame(()=>{enhanceQueued=false;enhance()});
  }).observe(root,{childList:true,subtree:true});

  document.addEventListener('visibilitychange',restartPresencePolling);
  window.addEventListener('online',restartPresencePolling);
  window.addEventListener('offline',()=>{
    if(lastPresence?.opponent)lastPresence={...lastPresence,opponent:{...lastPresence.opponent,online:false}};
    renderPresence();
  });
  restartPresencePolling();
  enhance();
})();
