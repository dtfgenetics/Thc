(()=>{
  const HISTORY_KEY='ptpMatchHistoryV2';
  let recordedKey='';

  function getHistory(){
    try{return JSON.parse(localStorage.getItem(HISTORY_KEY)||'[]')}catch{return []}
  }
  function saveHistory(items){localStorage.setItem(HISTORY_KEY,JSON.stringify(items.slice(0,10)))}
  function esc(value=''){return String(value).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]))}

  function recordFinishedMatch(){
    if(typeof state==='undefined'||!state||state.status!=='finished')return;
    const key=`${state.code}:${state.round||1}`;if(recordedKey===key)return;recordedKey=key;
    const history=getHistory();if(history.some(item=>item.key===key))return;
    const me=state.me?.stats||{};const shots=Number(me.shots||0),hits=Number(me.hits||0);
    history.unshift({key,code:state.code,round:state.round||1,at:Date.now(),won:state.winnerId===state.me?.id,opponent:state.opponent?.name||'Opponent',shots,hits,accuracy:shots?Math.round(hits/shots*100):0});
    saveHistory(history);
  }

  function injectHistory(){
    const stage=document.querySelector('.lobby-stage');if(!stage||stage.querySelector('.ptp-history-panel'))return;
    const history=getHistory();if(!history.length)return;
    const panel=document.createElement('section');panel.className='ornament-panel ptp-history-panel';
    panel.innerHTML=`<h2 class="panel-title">Recent Matches</h2><div class="ptp-history-list">${history.slice(0,5).map(item=>`<div class="ptp-history-row ${item.won?'win':'loss'}"><span class="ptp-history-icon">${item.won?'🌿':'✹'}</span><div><strong>${item.won?'Garden Protected':'Garden Lost'}</strong><small>vs ${esc(item.opponent)} · Round ${item.round}</small></div><div class="ptp-history-stat"><strong>${item.accuracy}%</strong><small>${item.hits}/${item.shots} hits</small></div></div>`).join('')}</div>`;
    stage.append(panel);
  }

  function injectQuickChat(){
    const form=document.querySelector('#chatForm');if(!form||form.parentElement.querySelector('.ptp-quick-chat'))return;
    const row=document.createElement('div');row.className='ptp-quick-chat';
    row.innerHTML='<button type="button" data-ptp-quick="Nice hit 🌿">Nice hit</button><button type="button" data-ptp-quick="Good shot 🎯">Good shot</button><button type="button" data-ptp-quick="GG 🔥">GG</button>';
    form.before(row);
  }

  function injectResultShare(){
    const banner=document.querySelector('.result-banner');if(!banner||banner.querySelector('[data-ptp-extra="share-result"]'))return;
    const button=document.createElement('button');button.type='button';button.className='btn ghost';button.dataset.ptpExtra='share-result';button.textContent='Share Result';banner.append(button);
  }

  async function shareResult(){
    if(typeof state==='undefined'||!state)return;
    const won=state.winnerId===state.me?.id;const me=state.me?.stats||{};const shots=Number(me.shots||0),hits=Number(me.hits||0),accuracy=shots?Math.round(hits/shots*100):0;
    const text=`${won?'I protected my garden':'Good game'} in Protect the Plants — ${hits}/${shots} hits (${accuracy}% accuracy).`;
    const url=`${location.origin}${location.pathname}`;const data={title:'Protect the Plants',text,url};
    try{
      if(navigator.share)await navigator.share(data);
      else{await navigator.clipboard.writeText(`${text} ${url}`);toast('Result copied.')}
    }catch(err){if(err?.name!=='AbortError')toast('Could not share the result.')}
  }

  function resetLocalPlacementAfterRematch(snapshot){
    if(snapshot?.lastEvent?.type!=='rematch-started')return;
    try{
      if(typeof emptyPlacement==='function')emptyPlacement();
      if(typeof battleEvents!=='undefined')battleEvents=[];
      if(typeof lastEventId!=='undefined')lastEventId=snapshot.lastEvent.id||'';
    }catch{}
  }

  function installAdaptivePolling(){
    if(typeof startPoll!=='function'||typeof stopPoll!=='function'||startPoll.__ptpAdaptive)return;
    const baseStop=stopPoll;
    const adaptive=function(){
      baseStop();
      const delay=document.hidden?5000:1400;
      pollTimer=setInterval(refresh,delay);
    };
    adaptive.__ptpAdaptive=true;
    startPoll=adaptive;
    document.addEventListener('visibilitychange',()=>{
      if(typeof identity==='undefined'||!identity?.code)return;
      startPoll();
      if(!document.hidden&&typeof refresh==='function')refresh();
    });
    window.addEventListener('online',()=>{if(typeof refresh==='function')refresh()});
  }

  function enhance(){
    recordFinishedMatch();injectHistory();injectQuickChat();injectResultShare();installAdaptivePolling();
  }

  if(typeof api==='function'&&!api.__ptpExtras){
    const previousApi=api;
    const wrapped=async function(action,options={}){
      const result=await previousApi(action,options);resetLocalPlacementAfterRematch(result);return result;
    };
    wrapped.__ptpExtras=true;api=wrapped;
  }

  document.addEventListener('click',event=>{
    const quick=event.target.closest?.('[data-ptp-quick]');
    if(quick){const input=document.querySelector('#chatInput'),form=document.querySelector('#chatForm');if(input&&form){input.value=quick.dataset.ptpQuick;form.requestSubmit()}return}
    if(event.target.closest?.('[data-ptp-extra="share-result"]'))shareResult();
  });

  const root=document.querySelector('#app');if(root)new MutationObserver(()=>requestAnimationFrame(enhance)).observe(root,{childList:true,subtree:true});
  if('serviceWorker' in navigator&&location.protocol==='https:')window.addEventListener('load',()=>navigator.serviceWorker.register('./sw.js').catch(()=>{}));
  enhance();
})();