(()=>{
  const VERSION='bud-or-bluff-visual-state-v3';
  const locked=document.querySelector('#lockedVote');
  const lockedText=document.querySelector('#lockedVoteText');
  const timer=document.querySelector('#timerText');
  const roundMeta=document.querySelector('.round-meta');
  const card=document.querySelector('#strainCard');
  const revealAnswer=document.querySelector('#revealAnswer');
  const scoreboard=document.querySelector('#scoreboard');
  const stageHead=document.querySelector('.stage-head');
  let mobilePlayerRail=null;

  function normalizedVote(value){
    const vote=String(value||'').trim().toUpperCase();
    return vote==='BUD'||vote==='BLUFF'?vote:'';
  }

  function syncLockedVote(){
    if(!locked)return;
    const vote=normalizedVote(lockedText?.textContent);
    if(vote)locked.dataset.vote=vote;
    else delete locked.dataset.vote;
  }

  function syncTimer(){
    if(!roundMeta||!timer)return;
    const raw=String(timer.textContent||'').trim();
    const seconds=Number(raw);
    if(!Number.isFinite(seconds)){
      delete roundMeta.dataset.urgency;
      return;
    }
    roundMeta.dataset.urgency=seconds<=5?'critical':seconds<=10?'low':'normal';
  }

  function syncReveal(){
    if(!card)return;
    const answer=normalizedVote(revealAnswer?.textContent);
    const revealVisible=Boolean(revealAnswer&&!revealAnswer.closest('.hidden'));
    if(answer&&revealVisible)card.dataset.answer=answer;
    else delete card.dataset.answer;
  }

  function ensureMobilePlayerRail(){
    if(mobilePlayerRail||!stageHead)return mobilePlayerRail;
    mobilePlayerRail=document.createElement('div');
    mobilePlayerRail.id='mobilePlayerRail';
    mobilePlayerRail.className='mobile-player-rail';
    mobilePlayerRail.setAttribute('role','list');
    mobilePlayerRail.setAttribute('aria-label','Player scores');
    stageHead.insertAdjacentElement('afterend',mobilePlayerRail);
    return mobilePlayerRail;
  }

  function syncMobilePlayerRail(){
    const rail=ensureMobilePlayerRail();
    if(!rail||!scoreboard)return;
    const rows=[...scoreboard.querySelectorAll('.score-row')];
    rail.replaceChildren();
    rows.forEach((row)=>{
      const name=(row.querySelector('.player-name')?.textContent||'Player').replace(/★/g,'').trim();
      const score=(row.querySelector('.player-score')?.textContent||'0').trim();
      const item=document.createElement('span');
      item.className=`mobile-player-chip${row.classList.contains('me')?' me':''}`;
      item.setAttribute('role','listitem');
      item.setAttribute('aria-label',`${name}, ${score} points`);

      const avatar=document.createElement('b');
      avatar.className='mobile-player-avatar';
      avatar.textContent=name.split(/\s+/).filter(Boolean).map(part=>part[0]).join('').slice(0,2).toUpperCase()||'?';

      const copy=document.createElement('span');
      const playerName=document.createElement('i');
      playerName.textContent=name;
      const playerScore=document.createElement('strong');
      playerScore.textContent=score;
      copy.append(playerName,playerScore);
      item.append(avatar,copy);
      rail.append(item);
    });
  }

  const observers=[];
  function observe(node,callback){
    if(!node||typeof MutationObserver!=='function')return;
    const observer=new MutationObserver(callback);
    observer.observe(node,{subtree:true,childList:true,characterData:true,attributes:true,attributeFilter:['class','hidden']});
    observers.push(observer);
  }

  observe(lockedText,syncLockedVote);
  observe(locked,syncLockedVote);
  observe(timer,syncTimer);
  observe(revealAnswer,syncReveal);
  observe(document.querySelector('#revealPanel'),syncReveal);
  observe(scoreboard,syncMobilePlayerRail);

  syncLockedVote();syncTimer();syncReveal();syncMobilePlayerRail();
  document.documentElement.dataset.budOrBluffVisualState=VERSION;
  window.__BUD_OR_BLUFF_VISUAL_STATE__=Object.freeze({
    version:VERSION,
    snapshot:()=>({
      lockedVote:locked?.dataset.vote||null,
      timerUrgency:roundMeta?.dataset.urgency||null,
      revealAnswer:card?.dataset.answer||null,
      mobilePlayers:mobilePlayerRail?.children.length||0
    }),
    sync:()=>{syncLockedVote();syncTimer();syncReveal();syncMobilePlayerRail();},
    dispose:()=>observers.splice(0).forEach(observer=>observer.disconnect())
  });
})();
