(() => {
  const API = 'api-v2.php';
  const POLL_MS = 1250;
  const SESSION_KEY = 'dtf_bob_session_v2';
  const SOUND_KEY = 'dtf_bob_sound_v2';
  let session = null;
  let room = null;
  let pollTimer = null;
  let ticker = null;
  let lastEventId = null;
  let lastRevision = -1;
  let clockOffset = 0;
  let soundOn = localStorage.getItem(SOUND_KEY) !== 'off';
  let reconnecting = false;

  const $ = (id) => document.getElementById(id);
  const els = {
    home:$('homeView'),room:$('roomView'),homeError:$('homeError'),roomError:$('roomError'),createForm:$('createForm'),joinForm:$('joinForm'),createName:$('createName'),joinName:$('joinName'),joinCode:$('joinCode'),roundCount:$('roundCount'),
    phase:$('phaseLabel'),title:$('stageTitle'),copyCode:$('copyCode'),lobbyStage:$('lobbyStage'),playStage:$('playStage'),finishStage:$('finishStage'),lobbyPlayers:$('lobbyPlayers'),start:$('startButton'),roundLabel:$('roundLabel'),timerFill:$('timerFill'),timerText:$('timerText'),difficulty:$('difficulty'),voteCount:$('voteCount'),strainName:$('strainName'),strainClue:$('strainClue'),revealPanel:$('revealPanel'),revealAnswer:$('revealAnswer'),realityText:$('realityText'),sourceText:$('sourceText'),voteControls:$('voteControls'),doubleWrap:$('doubleWrap'),doubleToggle:$('doubleToggle'),lockedVote:$('lockedVote'),lockedVoteText:$('lockedVoteText'),next:$('nextButton'),scoreboard:$('scoreboard'),playerCounter:$('playerCounter'),chatMessages:$('chatMessages'),chatForm:$('chatForm'),chatInput:$('chatInput'),finalStandings:$('finalStandings'),winnerTitle:$('winnerTitle'),winnerSub:$('winnerSub'),newRoom:$('newRoomButton'),sound:$('soundToggle'),leave:$('leaveButton')
  };
  const htmlMap = {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'};
  const esc = (value='') => String(value).replace(/[&<>"']/g, c => htmlMap[c]);
  const setHidden = (el, hidden) => el && el.classList.toggle('hidden', hidden);
  const isHost = () => room && room.me.id === room.hostId;
  const activePlayers = () => room ? room.players.filter(p => p.active) : [];

  function injectV2UI() {
    document.querySelector('.top-actions')?.insertAdjacentHTML('afterbegin', '<span id="connectionStatus" class="connection-pill">Connected</span><button id="shareTop" class="icon-button hidden" type="button">Share</button><button id="endGameButton" class="icon-button danger hidden" type="button">End game</button>');
    els.lobbyPlayers?.insertAdjacentHTML('afterend', `
      <div id="lobbyTools" class="lobby-tools">
        <div class="invite-actions"><button id="shareInvite" class="secondary-action" type="button">Share invite</button><button id="copyInvite" class="secondary-action" type="button">Copy link</button><button id="lockLobby" class="secondary-action hidden" type="button">Lock lobby</button></div>
        <div id="hostSettings" class="host-settings hidden">
          <label>Rounds<select id="settingRounds"><option>8</option><option selected>12</option><option>16</option><option>20</option></select></label>
          <label>Vote time<select id="settingVote"><option value="15">15 sec</option><option value="24" selected>24 sec</option><option value="35">35 sec</option><option value="45">45 sec</option><option value="0">No timer</option></select></label>
          <label>Reveal time<select id="settingReveal"><option value="6">6 sec</option><option value="9" selected>9 sec</option><option value="12">12 sec</option><option value="20">20 sec</option></select></label>
          <label class="toggle-setting"><input id="settingAuto" type="checkbox" checked><span>Auto-advance</span></label>
          <button id="saveSettings" class="secondary-action" type="button">Save settings</button>
        </div>
        <p id="settingsSummary" class="settings-summary"></p>
      </div>`);
    els.revealPanel?.insertAdjacentHTML('beforeend', '<div id="roundStats" class="round-stats"></div>');
    els.next?.insertAdjacentHTML('beforebegin', '<button id="hostRevealButton" class="secondary-action hidden" type="button">Reveal now</button>');
    els.newRoom.textContent = 'Leave room';
    els.newRoom.insertAdjacentHTML('beforebegin','<button id="rematchButton" class="primary-action hidden" type="button">Rematch same room</button>');
  }
  injectV2UI();
  Object.assign(els,{connection:$('connectionStatus'),shareTop:$('shareTop'),endGame:$('endGameButton'),lobbyTools:$('lobbyTools'),shareInvite:$('shareInvite'),copyInvite:$('copyInvite'),lockLobby:$('lockLobby'),hostSettings:$('hostSettings'),settingRounds:$('settingRounds'),settingVote:$('settingVote'),settingReveal:$('settingReveal'),settingAuto:$('settingAuto'),saveSettings:$('saveSettings'),settingsSummary:$('settingsSummary'),roundStats:$('roundStats'),hostReveal:$('hostRevealButton'),rematch:$('rematchButton')});

  function showError(el,message){if(!el)return;el.textContent=message;setHidden(el,false);setTimeout(()=>setHidden(el,true),4200);}
  function saveSession(data){session=data;if(data)localStorage.setItem(SESSION_KEY,JSON.stringify(data));else localStorage.removeItem(SESSION_KEY);}
  function loadSession(){try{return JSON.parse(localStorage.getItem(SESSION_KEY)||'null')}catch{return null}}
  function inviteUrl(code=room?.code){const url=new URL(location.href);url.searchParams.set('room',code||'');return url.toString();}
  function syncUrl(code){const url=new URL(location.href);if(code)url.searchParams.set('room',code);else url.searchParams.delete('room');history.replaceState(null,'',url);}

  async function request(action,options={}){
    const qs=new URLSearchParams({action});if(session?.code)qs.set('code',session.code);
    const headers={'Content-Type':'application/json'};if(session?.playerId)headers['X-Player-Id']=session.playerId;if(session?.token)headers['X-Player-Token']=session.token;
    const res=await fetch(`${API}?${qs}`,{method:options.method||'GET',headers,body:options.body?JSON.stringify(options.body):undefined,cache:'no-store'});
    const data=await res.json().catch(()=>({}));if(!res.ok)throw new Error(data.error||'The room server rejected that request.');return data;
  }

  function setConnection(ok,label){reconnecting=!ok;if(!els.connection)return;els.connection.textContent=label||(ok?'Connected':'Reconnecting…');els.connection.classList.toggle('bad',!ok);}
  function audioPulse(kind='tap'){if(!soundOn)return;try{const Ctx=window.AudioContext||window.webkitAudioContext;const ctx=new Ctx();const osc=ctx.createOscillator();const gain=ctx.createGain();const map={tap:[220,.045,.03],bud:[420,.12,.06],bluff:[150,.14,.06],reveal:[560,.18,.07],win:[660,.24,.08]};const [freq,dur,vol]=map[kind]||map.tap;osc.frequency.value=freq;osc.type=kind==='bluff'?'sawtooth':'sine';gain.gain.setValueAtTime(vol,ctx.currentTime);gain.gain.exponentialRampToValueAtTime(.0001,ctx.currentTime+dur);osc.connect(gain).connect(ctx.destination);osc.start();osc.stop(ctx.currentTime+dur);osc.onended=()=>ctx.close();}catch{}}
  function animateCard(){const card=$('strainCard');if(!card||matchMedia('(prefers-reduced-motion: reduce)').matches)return;card.animate([{opacity:.2,transform:'translateY(12px) scale(.985)'},{opacity:1,transform:'translateY(0) scale(1)'}],{duration:340,easing:'cubic-bezier(.2,.8,.2,1)'});}

  async function enterSession(auth){saveSession(auth);syncUrl(auth.code);setHidden(els.home,true);setHidden(els.room,false);setHidden(els.leave,false);setHidden(els.shareTop,false);await refresh();startPolling();}
  async function leaveRoom(){if(session){try{await request('leave',{method:'POST',body:{}})}catch{}}stopPolling();room=null;lastEventId=null;lastRevision=-1;saveSession(null);syncUrl(null);setHidden(els.room,true);setHidden(els.home,false);setHidden(els.leave,true);setHidden(els.shareTop,true);els.joinCode.value='';}
  function startPolling(){stopPolling();pollTimer=setInterval(()=>refresh(true),POLL_MS);ticker=setInterval(updateTimer,100);}
  function stopPolling(){if(pollTimer)clearInterval(pollTimer);if(ticker)clearInterval(ticker);pollTimer=ticker=null;}
  async function refresh(silent=false){if(!session)return;try{const next=await request('state');clockOffset=(next.serverNow||Date.now())-Date.now();setConnection(true);const changed=next.revision!==lastRevision||next.status!==room?.status;room=next;if(changed){lastRevision=next.revision;render();}else{updateTimer();}}catch(err){setConnection(false);if(!silent)showError(els.roomError,err.message);if(/not found|expired|session/i.test(err.message))leaveRoom();}}

  function render(){if(!room)return;els.copyCode.textContent=room.code;els.playerCounter.textContent=`${activePlayers().length} / 10`;setHidden(els.endGame,!(isHost()&&['voting','reveal'].includes(room.status)));renderScoreboard();renderChat();const eid=room.lastEvent?.id;if(eid&&eid!==lastEventId){if(room.lastEvent.type==='round-start'){animateCard();audioPulse('tap')}if(room.lastEvent.type==='round-reveal'){animateCard();audioPulse('reveal')}if(room.lastEvent.type==='game-finished')audioPulse('win');lastEventId=eid}if(room.status==='lobby')renderLobby();else if(room.status==='voting'||room.status==='reveal')renderPlay();else if(room.status==='finished')renderFinish();}

  function renderLobby(){setHidden(els.lobbyStage,false);setHidden(els.playStage,true);setHidden(els.finishStage,true);els.phase.textContent=room.joinLocked?'Lobby locked':'Lobby';els.title.textContent=`${activePlayers().length} player${activePlayers().length===1?'':'s'} connected`;els.lobbyPlayers.innerHTML=room.players.filter(p=>p.active).map(p=>`<span class="avatar-chip"><span class="avatar-dot">${esc(p.name.slice(0,2).toUpperCase())}</span>${esc(p.name)}${p.host?'<span class="host-crown">★</span>':''}${isHost()&&!p.host?`<button class="kick-mini" data-kick="${esc(p.id)}" type="button" aria-label="Remove ${esc(p.name)}">×</button>`:''}</span>`).join('');
    setHidden(els.start,!isHost());els.start.disabled=activePlayers().length<2;els.start.textContent=activePlayers().length<2?'Need 2 players':`Start ${room.roundLimit}-round game`;setHidden(els.hostSettings,!isHost());setHidden(els.lockLobby,!isHost());els.lockLobby.textContent=room.joinLocked?'Unlock lobby':'Lock lobby';els.settingsSummary.textContent=`${room.roundLimit} rounds · ${room.voteSeconds===0?'no vote timer':room.voteSeconds+'s voting'} · ${room.revealSeconds}s reveal · ${room.autoAdvance?'auto advance':'host advance'}`;
    if(isHost()){els.settingRounds.value=String(room.roundLimit);els.settingVote.value=String(room.voteSeconds);els.settingReveal.value=String(room.revealSeconds);els.settingAuto.checked=Boolean(room.autoAdvance)}
    document.querySelectorAll('[data-kick]').forEach(btn=>btn.onclick=()=>kickPlayer(btn.dataset.kick));
  }

  function renderPlay(){setHidden(els.lobbyStage,true);setHidden(els.playStage,false);setHidden(els.finishStage,true);const reveal=room.status==='reveal';els.phase.textContent=reveal?'Reveal':'Voting live';els.title.textContent=reveal?'The room has its answer.':'Bud or bluff?';els.roundLabel.textContent=`Round ${room.round} / ${room.roundLimit}`;els.difficulty.textContent=room.card?.difficulty||'';els.strainName.textContent=room.card?.name||'Loading…';els.strainClue.textContent=room.card?.clue||'';const locked=activePlayers().filter(p=>p.hasVoted).length;els.voteCount.textContent=`${locked} / ${activePlayers().length} locked`;const meVoted=room.me.hasVoted;setHidden(els.voteControls,reveal||meVoted);setHidden(els.doubleWrap,reveal||meVoted||!room.me.doubleAvailable);if(!meVoted)els.doubleToggle.checked=false;setHidden(els.lockedVote,reveal||!meVoted);if(meVoted&&room.me.vote)els.lockedVoteText.textContent=room.me.vote;setHidden(els.revealPanel,!reveal);setHidden(els.hostReveal,!(isHost()&&!reveal));setHidden(els.next,!(reveal&&isHost()));if(reveal){els.revealAnswer.textContent=room.card.answer;els.revealAnswer.className=`reveal-answer ${room.card.answer.toLowerCase()}`;els.realityText.textContent=room.card.reality||'';els.sourceText.textContent=room.card.source?`Verification: ${room.card.source}`:'';renderRoundStats()}updateTimer();}

  function renderRoundStats(){if(!els.roundStats)return;const s=room.roundSummary||{budVotes:0,bluffVotes:0,correct:0,active:activePlayers().length};const total=Math.max(1,s.active);const budPct=Math.round((s.budVotes/total)*100);const correct=room.players.filter(p=>p.active&&p.vote===room.card.answer);const fooled=room.players.filter(p=>p.active&&p.vote!==room.card.answer);els.roundStats.innerHTML=`<div class="split-head"><strong>Room vote</strong><span>${s.correct}/${s.active} correct</span></div><div class="vote-split"><span class="split-bud" style="width:${budPct}%"></span><span class="split-bluff" style="width:${100-budPct}%"></span></div><div class="split-labels"><span>BUD ${s.budVotes}</span><span>BLUFF ${s.bluffVotes}</span></div><div class="result-groups"><div><small>Called it</small><p>${correct.map(p=>`<span>${esc(p.name)}${p.usedDouble?' ×2':''}</span>`).join('')||'<em>Nobody</em>'}</p></div><div><small>Got fooled</small><p>${fooled.map(p=>`<span>${esc(p.name)}${p.usedDouble?' −1':''}</span>`).join('')||'<em>Nobody</em>'}</p></div></div>`;}

  function renderFinish(){setHidden(els.lobbyStage,true);setHidden(els.playStage,true);setHidden(els.finishStage,false);els.phase.textContent='Finished';els.title.textContent='Final scoreboard';const ranking=room.standings.filter(p=>p.active);if(ranking[0]){els.winnerTitle.textContent=`${ranking[0].name} takes it.`;els.winnerSub.textContent=`${ranking[0].score} points · best bluff detector in the room.`}els.finalStandings.innerHTML=ranking.map((p,i)=>`<div class="final-row ${i<3?'podium':''}"><span class="final-place">#${i+1}</span><strong>${esc(p.name)}</strong><span class="final-score">${p.score}</span></div>`).join('');setHidden(els.rematch,!isHost());els.newRoom.textContent='Leave room';}

  function renderScoreboard(){const sorted=[...room.players].filter(p=>p.active).sort((a,b)=>(b.score-a.score)||(b.bestStreak-a.bestStreak)||a.name.localeCompare(b.name));els.scoreboard.innerHTML=sorted.map((p,i)=>`<div class="score-row ${p.id===room.me.id?'me':''}"><span class="rank">${i+1}</span><div class="player-copy"><div class="player-name">${esc(p.name)} ${p.host?'<span class="host-crown">★</span>':''} ${p.hasVoted&&room.status==='voting'?'<i class="vote-dot" title="Vote locked"></i>':''}</div><div class="player-sub">${p.streak?`${p.streak} streak · `:''}${p.doubleAvailable?'Double ready':'Double used'}</div></div><strong class="player-score">${p.score}</strong></div>`).join('');}
  function renderChat(){const nearBottom=els.chatMessages.scrollHeight-els.chatMessages.scrollTop-els.chatMessages.clientHeight<80;els.chatMessages.innerHTML=(room.chat||[]).map(m=>m.kind==='system'?`<div class="chat-line system">${esc(m.text)}</div>`:`<div class="chat-line"><b>${esc(m.name)}</b> ${esc(m.text)}</div>`).join('');if(nearBottom)els.chatMessages.scrollTop=els.chatMessages.scrollHeight;}
  function updateTimer(){if(!room||!['voting','reveal'].includes(room.status))return;const seconds=room.status==='voting'?room.voteSeconds:room.revealSeconds;const end=room.status==='voting'?room.voteEndsAt:room.revealEndsAt;if(end===null){els.timerText.textContent='∞';els.timerFill.style.transform='scaleX(1)';return}const total=Math.max(1,seconds*1000);const left=Math.max(0,end-(Date.now()+clockOffset));els.timerText.textContent=String(Math.ceil(left/1000));els.timerFill.style.transform=`scaleX(${Math.max(0,Math.min(1,left/total))})`;}

  async function shareRoom(){const url=inviteUrl();try{if(navigator.share){await navigator.share({title:'Bud or Bluff',text:`Join my Bud or Bluff room ${room.code}`,url});}else{await navigator.clipboard.writeText(url);showError(els.roomError,'Invite link copied.')}}catch(err){if(err.name!=='AbortError')showError(els.roomError,'Could not share the invite.')}}
  async function copyRoom(){try{await navigator.clipboard.writeText(inviteUrl());showError(els.roomError,'Invite link copied.');audioPulse('tap')}catch{showError(els.roomError,'Could not copy the invite.')}}
  async function kickPlayer(id){try{room=await request('kick',{method:'POST',body:{playerId:id}});lastRevision=-1;render()}catch(err){showError(els.roomError,err.message)}}
  async function hostAction(action,body={}){try{room=await request(action,{method:'POST',body});lastRevision=-1;clockOffset=(room.serverNow||Date.now())-Date.now();render()}catch(err){showError(els.roomError,err.message)}}

  document.querySelectorAll('.seg').forEach(btn=>btn.addEventListener('click',()=>{document.querySelectorAll('.seg').forEach(b=>b.classList.toggle('active',b===btn));setHidden(els.createForm,btn.dataset.tab!=='create');setHidden(els.joinForm,btn.dataset.tab!=='join');audioPulse('tap')}));
  els.createForm.addEventListener('submit',async e=>{e.preventDefault();setHidden(els.homeError,true);try{const auth=await request('create',{method:'POST',body:{name:els.createName.value,rounds:Number(els.roundCount.value),voteSeconds:24,revealSeconds:9,autoAdvance:true}});await enterSession(auth)}catch(err){showError(els.homeError,err.message)}});
  els.joinForm.addEventListener('submit',async e=>{e.preventDefault();setHidden(els.homeError,true);try{const auth=await request('join',{method:'POST',body:{name:els.joinName.value,code:els.joinCode.value.trim().toUpperCase()}});await enterSession(auth)}catch(err){showError(els.homeError,err.message)}});
  els.joinCode.addEventListener('input',()=>{els.joinCode.value=els.joinCode.value.toUpperCase().replace(/[^A-Z0-9]/g,'').slice(0,6)});
  els.copyCode.addEventListener('click',async()=>{try{await navigator.clipboard.writeText(room.code);const old=room.code;els.copyCode.textContent='COPIED';setTimeout(()=>{if(room)els.copyCode.textContent=old},900);audioPulse('tap')}catch{}});
  els.start.addEventListener('click',()=>hostAction('start'));
  document.querySelectorAll('.vote-button').forEach(btn=>btn.addEventListener('click',async()=>{const vote=btn.dataset.vote;document.querySelectorAll('.vote-button').forEach(b=>b.disabled=true);audioPulse(vote==='BUD'?'bud':'bluff');try{room=await request('vote',{method:'POST',body:{vote,double:els.doubleToggle.checked}});lastRevision=-1;render()}catch(err){showError(els.roomError,err.message)}finally{document.querySelectorAll('.vote-button').forEach(b=>b.disabled=false)}}));
  els.next.addEventListener('click',()=>hostAction('next'));els.hostReveal.addEventListener('click',()=>hostAction('reveal'));els.lockLobby.addEventListener('click',()=>hostAction('lock'));els.saveSettings.addEventListener('click',()=>hostAction('settings',{rounds:Number(els.settingRounds.value),voteSeconds:Number(els.settingVote.value),revealSeconds:Number(els.settingReveal.value),autoAdvance:els.settingAuto.checked}));
  els.shareInvite.addEventListener('click',shareRoom);els.shareTop.addEventListener('click',shareRoom);els.copyInvite.addEventListener('click',copyRoom);
  els.chatForm.addEventListener('submit',async e=>{e.preventDefault();const text=els.chatInput.value.trim();if(!text)return;els.chatInput.value='';try{room=await request('chat',{method:'POST',body:{text}});lastRevision=-1;render()}catch(err){showError(els.roomError,err.message)}});
  els.rematch.addEventListener('click',()=>hostAction('rematch'));els.newRoom.addEventListener('click',leaveRoom);els.leave.addEventListener('click',leaveRoom);els.endGame.addEventListener('click',()=>{if(confirm('End this game for everyone?'))hostAction('end')});
  els.sound.addEventListener('click',()=>{soundOn=!soundOn;localStorage.setItem(SOUND_KEY,soundOn?'on':'off');els.sound.textContent=soundOn?'Sound on':'Sound off';if(soundOn)audioPulse('tap')});els.sound.textContent=soundOn?'Sound on':'Sound off';

  async function boot(){session=loadSession();const invite=new URL(location.href).searchParams.get('room');if(invite&&!session){document.querySelector('[data-tab="join"]').click();els.joinCode.value=invite.toUpperCase().slice(0,6)}if(!session)return;setHidden(els.home,true);setHidden(els.room,false);setHidden(els.leave,false);setHidden(els.shareTop,false);try{await refresh();startPolling()}catch{leaveRoom()}}
  boot();
})();
