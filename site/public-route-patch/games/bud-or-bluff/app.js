(() => {
  const API = 'api.php';
  const POLL_MS = 1100;
  const SESSION_KEY = 'dtf_bob_session_v1';
  const SOUND_KEY = 'dtf_bob_sound_v1';
  let session = null;
  let room = null;
  let pollTimer = null;
  let ticker = null;
  let lastEventId = null;
  let soundOn = localStorage.getItem(SOUND_KEY) !== 'off';

  const $ = (id) => document.getElementById(id);
  const els = {
    home: $('homeView'), room: $('roomView'), homeError: $('homeError'), roomError: $('roomError'),
    createForm: $('createForm'), joinForm: $('joinForm'), createName: $('createName'), joinName: $('joinName'), joinCode: $('joinCode'), roundCount: $('roundCount'),
    phase: $('phaseLabel'), title: $('stageTitle'), copyCode: $('copyCode'), lobbyStage: $('lobbyStage'), playStage: $('playStage'), finishStage: $('finishStage'), lobbyPlayers: $('lobbyPlayers'), start: $('startButton'),
    roundLabel: $('roundLabel'), timerFill: $('timerFill'), timerText: $('timerText'), difficulty: $('difficulty'), voteCount: $('voteCount'), strainName: $('strainName'), strainClue: $('strainClue'),
    revealPanel: $('revealPanel'), revealAnswer: $('revealAnswer'), realityText: $('realityText'), sourceText: $('sourceText'), voteControls: $('voteControls'), doubleWrap: $('doubleWrap'), doubleToggle: $('doubleToggle'), lockedVote: $('lockedVote'), lockedVoteText: $('lockedVoteText'), next: $('nextButton'),
    scoreboard: $('scoreboard'), playerCounter: $('playerCounter'), chatMessages: $('chatMessages'), chatForm: $('chatForm'), chatInput: $('chatInput'),
    finalStandings: $('finalStandings'), winnerTitle: $('winnerTitle'), winnerSub: $('winnerSub'), newRoom: $('newRoomButton'), sound: $('soundToggle'), leave: $('leaveButton')
  };

  function esc(value='') { return String(value).replace(/[&<>'\"]/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','\"':'&quot;'}[c])); }
  function setHidden(el, hidden) { el.classList.toggle('hidden', hidden); }
  function showError(el, message) { el.textContent = message; setHidden(el, false); setTimeout(() => setHidden(el, true), 4200); }
  function saveSession(data) { session = data; if (data) localStorage.setItem(SESSION_KEY, JSON.stringify(data)); else localStorage.removeItem(SESSION_KEY); }
  function loadSession() { try { return JSON.parse(localStorage.getItem(SESSION_KEY) || 'null'); } catch { return null; } }

  async function request(action, options = {}) {
    const qs = new URLSearchParams({ action });
    if (session?.code) qs.set('code', session.code);
    const headers = { 'Content-Type': 'application/json' };
    if (session?.playerId) headers['X-Player-Id'] = session.playerId;
    if (session?.token) headers['X-Player-Token'] = session.token;
    const res = await fetch(`${API}?${qs.toString()}`, { method: options.method || 'GET', headers, body: options.body ? JSON.stringify(options.body) : undefined, cache: 'no-store' });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.error || 'The room server rejected that request.');
    return data;
  }

  function audioPulse(kind='tap') {
    if (!soundOn) return;
    try {
      const Ctx = window.AudioContext || window.webkitAudioContext;
      const ctx = new Ctx();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      const map = { tap:[220,.045,.035], bud:[420,.12,.07], bluff:[150,.14,.07], reveal:[560,.18,.08], win:[660,.24,.09] };
      const [freq,dur,vol] = map[kind] || map.tap;
      osc.frequency.setValueAtTime(freq, ctx.currentTime); osc.type = kind === 'bluff' ? 'sawtooth' : 'sine';
      gain.gain.setValueAtTime(vol, ctx.currentTime); gain.gain.exponentialRampToValueAtTime(.0001, ctx.currentTime + dur);
      osc.connect(gain).connect(ctx.destination); osc.start(); osc.stop(ctx.currentTime + dur); osc.addEventListener('ended', () => ctx.close());
    } catch {}
  }

  function animateCard() {
    const card = $('strainCard');
    if (!card || matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    card.animate([{opacity:.2,transform:'translateY(12px) scale(.985)'},{opacity:1,transform:'translateY(0) scale(1)'}],{duration:340,easing:'cubic-bezier(.2,.8,.2,1)'});
  }

  function syncUrl(code) {
    const url = new URL(location.href);
    if (code) url.searchParams.set('room', code); else url.searchParams.delete('room');
    history.replaceState(null, '', url);
  }

  async function enterSession(auth) {
    saveSession(auth); syncUrl(auth.code); setHidden(els.home, true); setHidden(els.room, false); setHidden(els.leave, false); await refresh(); startPolling();
  }

  function leaveRoom() {
    stopPolling(); room = null; lastEventId = null; saveSession(null); syncUrl(null); setHidden(els.room, true); setHidden(els.home, false); setHidden(els.leave, true); els.joinCode.value='';
  }

  function startPolling() { stopPolling(); pollTimer = setInterval(() => refresh(true), POLL_MS); ticker = setInterval(updateTimer, 100); }
  function stopPolling() { if (pollTimer) clearInterval(pollTimer); if (ticker) clearInterval(ticker); pollTimer = ticker = null; }

  async function refresh(silent=false) {
    if (!session) return;
    try { const next = await request('state'); room = next; render(); }
    catch (err) { if (!silent) showError(els.roomError, err.message); if (/not found|expired|session/i.test(err.message)) leaveRoom(); }
  }

  function render() {
    if (!room) return;
    els.copyCode.textContent = room.code;
    els.playerCounter.textContent = `${room.players.length} / 10`;
    renderScoreboard(); renderChat();
    const eventId = room.lastEvent?.id;
    if (eventId && eventId !== lastEventId) {
      if (room.lastEvent.type === 'round-start') { animateCard(); audioPulse('tap'); }
      if (room.lastEvent.type === 'round-reveal') { animateCard(); audioPulse('reveal'); }
      if (room.lastEvent.type === 'game-finished') audioPulse('win');
      lastEventId = eventId;
    }
    if (room.status === 'lobby') renderLobby();
    else if (room.status === 'voting' || room.status === 'reveal') renderPlay();
    else if (room.status === 'finished') renderFinish();
  }

  function renderLobby() {
    setHidden(els.lobbyStage,false); setHidden(els.playStage,true); setHidden(els.finishStage,true);
    els.phase.textContent='Lobby'; els.title.textContent=`${room.players.length} player${room.players.length===1?'':'s'} connected`;
    els.lobbyPlayers.innerHTML = room.players.map(p => `<span class="avatar-chip"><span class="avatar-dot">${esc(p.name.slice(0,2).toUpperCase())}</span>${esc(p.name)}${p.host?'<span class="host-crown">★</span>':''}</span>`).join('');
    const isHost = room.me.id === room.hostId; setHidden(els.start,!isHost); els.start.disabled = room.players.length < 2; els.start.textContent = room.players.length < 2 ? 'Need 2 players' : `Start ${room.roundLimit}-round game`;
  }

  function renderPlay() {
    setHidden(els.lobbyStage,true); setHidden(els.playStage,false); setHidden(els.finishStage,true);
    const reveal = room.status === 'reveal';
    els.phase.textContent = reveal ? 'Reveal' : 'Voting live';
    els.title.textContent = reveal ? 'The truth is out.' : 'Bud or bluff?';
    els.roundLabel.textContent = `Round ${room.round} / ${room.roundLimit}`;
    els.difficulty.textContent = room.card?.difficulty || '';
    els.strainName.textContent = room.card?.name || 'Loading…';
    els.strainClue.textContent = room.card?.clue || '';
    const locked = room.players.filter(p => p.hasVoted).length;
    els.voteCount.textContent = `${locked} / ${room.players.length} locked`;
    const meVoted = room.me.hasVoted;
    setHidden(els.voteControls, reveal || meVoted);
    setHidden(els.doubleWrap, reveal || meVoted || !room.me.doubleAvailable);
    if (!meVoted) els.doubleToggle.checked = false;
    setHidden(els.lockedVote, reveal || !meVoted);
    if (meVoted && room.me.vote) els.lockedVoteText.textContent = room.me.vote;
    setHidden(els.revealPanel,!reveal);
    if (reveal) {
      els.revealAnswer.textContent = room.card.answer;
      els.revealAnswer.className = `reveal-answer ${room.card.answer.toLowerCase()}`;
      els.realityText.textContent = room.card.reality || '';
      els.sourceText.textContent = room.card.source ? `Verification: ${room.card.source}` : '';
    }
    const isHost = room.me.id === room.hostId;
    setHidden(els.next, !(reveal && isHost));
    updateTimer();
  }

  function renderFinish() {
    setHidden(els.lobbyStage,true); setHidden(els.playStage,true); setHidden(els.finishStage,false);
    els.phase.textContent='Finished'; els.title.textContent='Final scoreboard';
    const ranking = room.standings || [];
    if (ranking[0]) { els.winnerTitle.textContent = `${ranking[0].name} takes it.`; els.winnerSub.textContent = `${ranking[0].score} points · best bluff detector in the room.`; }
    els.finalStandings.innerHTML = ranking.map((p,i) => `<div class="final-row"><span class="final-place">#${i+1}</span><strong>${esc(p.name)}</strong><span class="final-score">${p.score}</span></div>`).join('');
  }

  function renderScoreboard() {
    const sorted = [...room.players].sort((a,b)=>(b.score-a.score)||(b.bestStreak-a.bestStreak)||a.name.localeCompare(b.name));
    els.scoreboard.innerHTML = sorted.map((p,i) => `<div class="score-row ${p.id===room.me.id?'me':''}"><span class="rank">${i+1}</span><div class="player-copy"><div class="player-name">${esc(p.name)} ${p.host?'<span class="host-crown">★</span>':''} ${p.hasVoted&&room.status==='voting'?'<i class="vote-dot" title="Vote locked"></i>':''}</div><div class="player-sub">${p.streak?`${p.streak} streak · `:''}${p.doubleAvailable?'Double ready':'Double used'}</div></div><strong class="player-score">${p.score}</strong></div>`).join('');
  }

  function renderChat() {
    const nearBottom = els.chatMessages.scrollHeight - els.chatMessages.scrollTop - els.chatMessages.clientHeight < 80;
    els.chatMessages.innerHTML = (room.chat || []).map(m => m.kind === 'system' ? `<div class="chat-line system">${esc(m.text)}</div>` : `<div class="chat-line"><b>${esc(m.name)}</b> ${esc(m.text)}</div>`).join('');
    if (nearBottom) els.chatMessages.scrollTop = els.chatMessages.scrollHeight;
  }

  function updateTimer() {
    if (!room || !['voting','reveal'].includes(room.status)) return;
    const end = room.status === 'voting' ? room.voteEndsAt : room.revealEndsAt;
    const total = room.status === 'voting' ? 24000 : 9000;
    const left = Math.max(0, (end || Date.now()) - Date.now());
    els.timerText.textContent = String(Math.ceil(left/1000));
    els.timerFill.style.transform = `scaleX(${Math.max(0,Math.min(1,left/total))})`;
  }

  document.querySelectorAll('.seg').forEach(btn => btn.addEventListener('click', () => {
    document.querySelectorAll('.seg').forEach(b => b.classList.toggle('active', b===btn));
    setHidden(els.createForm, btn.dataset.tab !== 'create'); setHidden(els.joinForm, btn.dataset.tab !== 'join'); audioPulse('tap');
  }));

  els.createForm.addEventListener('submit', async e => {
    e.preventDefault(); setHidden(els.homeError,true);
    try { const auth = await request('create',{method:'POST',body:{name:els.createName.value,rounds:Number(els.roundCount.value)}}); await enterSession(auth); }
    catch(err){ showError(els.homeError,err.message); }
  });
  els.joinForm.addEventListener('submit', async e => {
    e.preventDefault(); setHidden(els.homeError,true);
    try { const code=els.joinCode.value.trim().toUpperCase(); const auth = await request('join',{method:'POST',body:{name:els.joinName.value,code}}); await enterSession(auth); }
    catch(err){ showError(els.homeError,err.message); }
  });
  els.joinCode.addEventListener('input', () => { els.joinCode.value = els.joinCode.value.toUpperCase().replace(/[^A-Z0-9]/g,'').slice(0,6); });
  els.copyCode.addEventListener('click', async () => { try { await navigator.clipboard.writeText(room.code); els.copyCode.textContent='COPIED'; setTimeout(()=>{if(room)els.copyCode.textContent=room.code},900); audioPulse('tap'); } catch {} });
  els.start.addEventListener('click', async () => { try { room=await request('start',{method:'POST',body:{}}); render(); } catch(err){ showError(els.roomError,err.message); } });
  document.querySelectorAll('.vote-button').forEach(btn => btn.addEventListener('click', async () => {
    const vote=btn.dataset.vote; btn.disabled=true; audioPulse(vote==='BUD'?'bud':'bluff');
    try { room=await request('vote',{method:'POST',body:{vote,double:els.doubleToggle.checked}}); render(); }
    catch(err){ showError(els.roomError,err.message); } finally { document.querySelectorAll('.vote-button').forEach(b=>b.disabled=false); }
  }));
  els.next.addEventListener('click', async () => { try { room=await request('next',{method:'POST',body:{}}); render(); } catch(err){ showError(els.roomError,err.message); } });
  els.chatForm.addEventListener('submit', async e => { e.preventDefault(); const text=els.chatInput.value.trim(); if(!text)return; els.chatInput.value=''; try { room=await request('chat',{method:'POST',body:{text}}); render(); } catch(err){ showError(els.roomError,err.message); } });
  els.newRoom.addEventListener('click', leaveRoom); els.leave.addEventListener('click', leaveRoom);
  els.sound.addEventListener('click',()=>{soundOn=!soundOn;localStorage.setItem(SOUND_KEY,soundOn?'on':'off');els.sound.textContent=soundOn?'Sound on':'Sound off';if(soundOn)audioPulse('tap')}); els.sound.textContent=soundOn?'Sound on':'Sound off';

  async function boot() {
    session = loadSession();
    const invite = new URL(location.href).searchParams.get('room');
    if (invite && !session) { document.querySelector('[data-tab="join"]').click(); els.joinCode.value=invite.toUpperCase().slice(0,6); }
    if (!session) return;
    setHidden(els.home,true); setHidden(els.room,false); setHidden(els.leave,false);
    try { await refresh(); startPolling(); } catch { leaveRoom(); }
  }
  boot();
})();
