(()=>{
  const VERSION='bud-or-bluff-visual-state-v3';
  const locked=document.querySelector('#lockedVote');
  const lockedText=document.querySelector('#lockedVoteText');
  const timer=document.querySelector('#timerText');
  const roundMeta=document.querySelector('.round-meta');
  const card=document.querySelector('#strainCard');
  const revealAnswer=document.querySelector('#revealAnswer');

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

  syncLockedVote();syncTimer();syncReveal();
  document.documentElement.dataset.budOrBluffVisualState=VERSION;
  window.__BUD_OR_BLUFF_VISUAL_STATE__=Object.freeze({
    version:VERSION,
    snapshot:()=>({
      lockedVote:locked?.dataset.vote||null,
      timerUrgency:roundMeta?.dataset.urgency||null,
      revealAnswer:card?.dataset.answer||null
    }),
    sync:()=>{syncLockedVote();syncTimer();syncReveal();},
    dispose:()=>observers.splice(0).forEach(observer=>observer.disconnect())
  });
})();
