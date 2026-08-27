(()=>{
  const PRODUCT='Burn Buds';
  const LEAF=`<svg viewBox="0 0 120 120" aria-hidden="true" focusable="false"><g fill="currentColor"><path d="M60 7c8 18 9 34 2 49 9-13 20-24 35-32-2 18-10 32-25 41 12-5 25-6 39-3-8 15-19 25-35 30 11 0 21 3 30 9-12 8-25 10-39 7l-5-2v9h-4v-9l-5 2c-14 3-27 1-39-7 9-6 19-9 30-9-16-5-27-15-35-30 14-3 27-2 39 3-15-9-23-23-25-41 15 8 26 19 35 32-7-15-6-31 2-49Z"/></g><path d="M60 44v67" fill="none" stroke="currentColor" stroke-width="4" stroke-linecap="round"/></svg>`;

  const setText=(selector,value)=>document.querySelectorAll(selector).forEach(el=>{if(el.textContent!==value)el.textContent=value});
  const setHtml=(selector,value)=>document.querySelectorAll(selector).forEach(el=>{if(el.innerHTML!==value)el.innerHTML=value});

  function brandIcons(){
    document.querySelectorAll('.brand-mark,.mini-leaf,.demo-plant,.plant-token,.hero-leaf,.active-plant').forEach(el=>{
      if(el.dataset.burnBudsIcon==='1')return;
      el.innerHTML=LEAF;
      el.dataset.burnBudsIcon='1';
    });
  }

  function brandView(){
    setText('.brand-copy strong',PRODUCT);
    setHtml('.hero-title','Burn <span>Buds</span>');
    setHtml('.battle-brand strong','Burn <span>Buds</span>');
    setText('.hero-tagline','Hide your buds. Burn theirs.');
    setText('.hero-sub','A two-player 15×15 hidden-fleet strategy battle. Place five cannabis-leaf formations, take turns firing on your opponent’s grid, burn every hidden formation, and be the last stash standing.');
    setText('.lobby-preview .panel-title','Your Stash Preview');
    setText('.lobby-preview .muted','15×15 battle grid with cannabis-leaf formations, hit markers, and firing history.');
    setText('.formation-strip .panel-title','Bud Formations');

    document.querySelectorAll('.status-pill').forEach(el=>{
      const map={'Garden Locked':'Stash Locked','Place Your Plants':'Place Your Buds','Garden Protected':'Buds Protected','Garden Lost':'Your Buds Burned'};
      if(map[el.textContent])el.textContent=map[el.textContent];
    });
    document.querySelectorAll('.result-banner strong').forEach(el=>{
      if(el.textContent==='Garden Protected')el.textContent='Opponent Buds Burned';
      if(el.textContent==='Garden Lost')el.textContent='Your Buds Burned';
    });
    document.querySelectorAll('.result-banner .muted').forEach(el=>{
      if(el.textContent.includes('found every opponent formation'))el.textContent='You burned every opponent formation.';
      if(el.textContent.includes('found every hidden formation'))el.textContent='Your opponent burned every hidden formation.';
    });
    document.querySelectorAll('.event strong').forEach(el=>{if(el.textContent==='FORMATION FOUND')el.textContent='BUDS BURNED'});
    document.querySelectorAll('.event div:last-child').forEach(el=>{
      if(el.textContent.includes(' found ')&&el.textContent.includes('formation'))el.textContent=el.textContent.replace(' found ',' burned ');
      if(el.textContent.includes('protected the garden'))el.textContent=el.textContent.replace('protected the garden','burned every opposing bud');
    });

    const subtitle=document.querySelector('#plantLossSubtitle');
    if(subtitle?.textContent.includes('has been found.'))subtitle.textContent=subtitle.textContent.replace('has been found.','has been burned.');
    brandIcons();

    if(document.title.includes('Protect the Plants'))document.title=document.title.replace('Protect the Plants',PRODUCT);
  }

  async function share(data){
    try{
      if(navigator.share){await navigator.share(data);return true}
      await navigator.clipboard.writeText(`${data.text}\n${data.url}`);return true;
    }catch(err){if(err?.name==='AbortError')return true;return false}
  }

  document.addEventListener('click',async event=>{
    const invite=event.target.closest?.('[data-ptp-action="share"]');
    const result=event.target.closest?.('[data-ptp-extra="share-result"]');
    if(!invite&&!result)return;
    event.preventDefault();event.stopImmediatePropagation();
    try{
      if(typeof state==='undefined'||!state)return;
      const url=`${location.origin}${location.pathname}${invite?`?room=${state.code}`:''}`;
      if(invite){
        const ok=await share({title:PRODUCT,text:`Join my ${PRODUCT} game — room ${state.code}`,url});
        if(!ok&&typeof toast==='function')toast('Could not share the invite.');
      }else{
        const won=state.winnerId===state.me?.id;const stats=state.me?.stats||{};const shots=Number(stats.shots||0),hits=Number(stats.hits||0),accuracy=shots?Math.round(hits/shots*100):0;
        const ok=await share({title:PRODUCT,text:`${won?'I burned every opposing bud':'Good game'} in ${PRODUCT} — ${hits}/${shots} hits (${accuracy}% accuracy).`,url});
        if(!ok&&typeof toast==='function')toast('Could not share the result.');
      }
    }catch{}
  },true);

  const observer=new MutationObserver(()=>requestAnimationFrame(brandView));
  observer.observe(document.documentElement,{childList:true,subtree:true,characterData:true});
  brandView();
})();
