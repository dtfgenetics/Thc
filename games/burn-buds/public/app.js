const app = document.querySelector('#app');
const toastEl = document.querySelector('#toast');
const burnOverlay = document.querySelector('#burnOverlay');
const burnSubtitle = document.querySelector('#burnSubtitle');
const FLEET = [
  { id: 'king-cola', name: 'King Cola', size: 5 },
  { id: 'fat-bud', name: 'Fat Bud', size: 4 },
  { id: 'top-shelf', name: 'Top Shelf', size: 3 },
  { id: 'sticky-nug', name: 'Sticky Nug', size: 3 },
  { id: 'little-leaf', name: 'Little Leaf', size: 2 }
];
const GRID = 15;
let state = null;
let eventSource = null;
let placement = { fleet: [], selected: FLEET[0].id, horizontal: true };
let lastEventId = null;

const session = JSON.parse(localStorage.getItem('burnBudsSession') || '{}');
let identity = { name: session.name || '', playerId: session.playerId || '', code: session.code || '' };

function saveSession() { localStorage.setItem('burnBudsSession', JSON.stringify(identity)); }
function esc(s='') { return String(s).replace(/[&<>"']/g, m => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m])); }
function toast(msg) { toastEl.textContent = msg; toastEl.classList.add('show'); setTimeout(()=>toastEl.classList.remove('show'),2200); }
function api(path, opts={}) { return fetch(path, { headers:{'Content-Type':'application/json',...(opts.headers||{})}, ...opts }).then(async r => { const data = await r.json().catch(()=>({})); if(!r.ok) throw new Error(data.error || 'Request failed'); return data; }); }
function leafMark(){ return `<img src="/leaf.svg" alt="" />`; }

function shell(content, game=false) {
  return `<div class="shell"><header class="topbar"><div class="brand">${leafMark()} <span>BURN BUDS</span></div><div class="top-actions">${game?`<button class="btn ghost" data-action="lobby">← <span class="label">Lobby</span></button>`:''}</div></header><main class="main">${content}</main></div>`;
}

async function renderLobby() {
  closeEvents(); state = null;
  let active = [];
  if (identity.playerId) {
    try { active = (await api(`/api/active?playerId=${encodeURIComponent(identity.playerId)}`)).games || []; } catch {}
  }
  const activeHtml = active.length ? active.map(g => `<div class="active-card"><div class="active-meta"><div class="room-code">${esc(g.code)}</div><strong>${esc(g.opponent?.name || 'Waiting for opponent')}</strong><span class="muted">${g.status === 'playing' ? (g.turnPlayerId === g.me.id ? 'Your turn' : "Opponent's turn") : g.status}</span></div><button class="btn primary" data-action="resume" data-code="${esc(g.code)}">View Active Game</button></div>`).join('') : `<div class="empty">No active game yet.</div>`;
  app.innerHTML = shell(`
    <section class="hero"><div><h1>BURN<br><em>BUDS</em></h1><p>A 15×15 head-to-head fleet battle. Place your leaf fleet, call your shots, talk trash in the room chat, and burn every last bud before your opponent burns yours.</p></div><div class="hero-mark">${leafMark()}</div></section>
    <section class="lobby-grid">
      <div class="panel"><h2>Create a burn room</h2><div class="form-row"><input id="createName" class="input" maxlength="24" placeholder="Your player name" value="${esc(identity.name)}"><button class="btn primary" data-action="create">Create Game</button></div></div>
      <div class="panel"><h2>Join with room code</h2><div class="form-row"><input id="joinName" class="input" maxlength="24" placeholder="Your player name" value="${esc(identity.name)}"><input id="joinCode" class="input" maxlength="6" placeholder="ABC123"><button class="btn" data-action="join">Join Game</button></div></div>
      <div class="panel" style="grid-column:1/-1"><h2>Active game</h2>${activeHtml}</div>
    </section>`);
}

function emptyPlacement() { placement = { fleet: [], selected: FLEET[0].id, horizontal: true }; }
function placedShip(id){ return placement.fleet.find(s=>s.id===id); }
function placementCellMap(){ const map = new Map(); for(const s of placement.fleet) for(const c of s.cells) map.set(`${c.row}:${c.col}`, s.id); return map; }
function randomFleet(){
  const fleet=[]; const taken=new Set();
  for(const spec of FLEET){ let placed=false; for(let tries=0;tries<500&&!placed;tries++){ const horizontal=Math.random()>.5; const row=Math.floor(Math.random()*(horizontal?GRID:GRID-spec.size+1)); const col=Math.floor(Math.random()*(horizontal?GRID-spec.size+1:GRID)); const cells=Array.from({length:spec.size},(_,i)=>({row:row+(horizontal?0:i),col:col+(horizontal?i:0)})); if(cells.every(c=>!taken.has(`${c.row}:${c.col}`))){ cells.forEach(c=>taken.add(`${c.row}:${c.col}`)); fleet.push({id:spec.id,cells}); placed=true; } } }
  placement.fleet=fleet; renderGame();
}
function placeAt(row,col){
  if(!state?.me || state.me.ready) return;
  const spec=FLEET.find(f=>f.id===placement.selected); if(!spec) return;
  const cells=Array.from({length:spec.size},(_,i)=>({row:row+(placement.horizontal?0:i),col:col+(placement.horizontal?i:0)}));
  if(cells.some(c=>c.row>=GRID||c.col>=GRID)) return toast('That leaf runs off the board.');
  const taken=placementCellMap(); const existing=placedShip(spec.id); if(existing) existing.cells.forEach(c=>taken.delete(`${c.row}:${c.col}`));
  if(cells.some(c=>taken.has(`${c.row}:${c.col}`))) return toast('Leaves cannot overlap.');
  placement.fleet=placement.fleet.filter(s=>s.id!==spec.id); placement.fleet.push({id:spec.id,cells});
  const next=FLEET.find(f=>!placedShip(f.id)); if(next) placement.selected=next.id;
  renderGame();
}

function shotMap(shots=[]){ const m=new Map(); shots.forEach(s=>m.set(`${s.row}:${s.col}`,s)); return m; }
function myFleetCellMap(fleet=[]){ const m=new Map(); fleet.forEach(s=>s.cells.forEach(c=>m.set(`${c.row}:${c.col}`,s.id))); return m; }
function enemySunkShips(){
  if(!state?.opponent) return new Set();
  const hits=shotMap(state.opponent.shotsReceived); const set=new Set();
  if(state.opponent.fleet) state.opponent.fleet.forEach(s=>{ if(s.cells.every(c=>hits.get(`${c.row}:${c.col}`)?.hit)) set.add(s.id); });
  if(state.lastEvent?.type==='sunk' && state.lastEvent.targetPlayerId===state.opponent.id) set.add(state.lastEvent.shipId);
  return set;
}
function ownSunkShips(){
  const hits=shotMap(state.me?.shotsReceived||[]); const set=new Set();
  (state.me?.fleet||[]).forEach(s=>{ if(s.cells.every(c=>hits.get(`${c.row}:${c.col}`)?.hit)) set.add(s.id); }); return set;
}

function boardHtml({owner, enemy=false, placementMode=false}){
  const shots=shotMap(owner?.shotsReceived||[]); const fleetMap=myFleetCellMap(placementMode?placement.fleet:(owner?.fleet||[]));
  const sunk=enemy?enemySunkShips():ownSunkShips();
  let cells='';
  for(let r=0;r<GRID;r++) for(let c=0;c<GRID;c++){
    const shot=shots.get(`${r}:${c}`); const shipId=fleetMap.get(`${r}:${c}`); const isBurned=shipId&&sunk.has(shipId);
    const cls=['cell',shipId?'ship':'',shot?.hit?'hit':shot?'miss':'',isBurned?'burned':'',enemy&&state?.status==='playing'&&state.turnPlayerId===state.me?.id&&!shot?'can-fire':''].filter(Boolean).join(' ');
    const action=placementMode?`data-place="${r},${c}"`:enemy?`data-fire="${r},${c}"`:'';
    cells+=`<button class="${cls}" ${action} aria-label="row ${r+1} column ${c+1}"></button>`;
  }
  return `<div class="board ${enemy?'enemy':''}">${cells}</div>`;
}

function fleetLegend(owner, enemy=false){
  const sunk=enemy?enemySunkShips():ownSunkShips();
  return `<div class="fleet-legend">${FLEET.map(f=>`<span class="fleet-chip ${sunk.has(f.id)?'sunk':''}">${leafMark()} ${esc(f.name)} · ${f.size}</span>`).join('')}</div>`;
}

function statusText(){
  if(!state) return '';
  if(state.status==='waiting') return 'Waiting for an opponent to join…';
  if(state.status==='placement') return state.me.ready ? 'Fleet locked. Waiting for opponent…' : 'Place your leaf fleet';
  if(state.status==='playing') return state.turnPlayerId===state.me.id ? 'YOUR TURN — pick a target' : `${state.opponent?.name || 'Opponent'} is firing…`;
  if(state.status==='finished') return state.winnerId===state.me.id ? '🏆 YOU BURNED THE WHOLE GARDEN' : 'Your garden got burned.';
  return state.status;
}

function renderChat(){
  return `<aside class="panel chat"><h3>Room chat</h3><div class="chat-log" id="chatLog">${(state.chat||[]).map(m=>m.kind==='system'?`<div class="msg system">${esc(m.text)}</div>`:`<div class="msg"><span class="who">${esc(m.name)}</span><span class="time">${new Date(m.at).toLocaleTimeString([], {hour:'2-digit',minute:'2-digit'})}</span><div class="text">${esc(m.text)}</div></div>`).join('')}</div><form class="chat-form" id="chatForm"><input class="input" id="chatInput" maxlength="280" placeholder="Message opponent…"><button class="btn">Send</button></form></aside>`;
}

function renderGame(){
  if(!state) return;
  const placementMode=['waiting','placement'].includes(state.status)&&!state.me.ready;
  const placementControls=placementMode?`<div class="placement-help"><div class="ship-picker">${FLEET.map(f=>`<button class="ship-pick ${placement.selected===f.id?'active':''}" data-ship="${f.id}">${esc(f.name)} ${f.size}</button>`).join('')}</div><div><button class="btn ghost" data-action="rotate">Rotate: ${placement.horizontal?'Horizontal':'Vertical'}</button> <button class="btn ghost" data-action="random">Randomize</button> <button class="btn primary" data-action="lock" ${placement.fleet.length!==FLEET.length?'disabled':''}>Lock Fleet</button></div></div>`:'';
  const myBoardOwner=placementMode?{fleet:placement.fleet,shotsReceived:state.me.shotsReceived}:state.me;
  const oppTitle=state.opponent?esc(state.opponent.name):'Opponent';
  app.innerHTML=shell(`<div class="game-head"><div><div class="room-code">ROOM ${esc(state.code)}</div><h1 style="margin:.2rem 0 0">${esc(state.me.name)} vs ${oppTitle}</h1></div><div class="status-line ${state.turnPlayerId===state.me.id?'yours':''}">${esc(statusText())}</div></div>
    <div class="game-layout"><section><div class="panel" style="margin-bottom:16px">${placementControls}<div class="muted">Share code <strong class="room-code">${esc(state.code)}</strong> with your opponent.</div></div>
    <div class="boards"><div class="board-card"><div class="board-title"><h3>Your Garden</h3><span class="muted">15×15</span></div>${boardHtml({owner:myBoardOwner,placementMode})}${fleetLegend(myBoardOwner,false)}</div>
    <div class="board-card"><div class="board-title"><h3>${oppTitle}'s Garden</h3><span class="muted">Fire here</span></div>${boardHtml({owner:state.opponent||{shotsReceived:[]},enemy:true})}${fleetLegend(state.opponent||{},true)}</div></div></section>${renderChat()}</div>`,true);
  const log=document.querySelector('#chatLog'); if(log) log.scrollTop=log.scrollHeight;
}

function showBurn(event){
  const spec=FLEET.find(f=>f.id===event.shipId); burnSubtitle.textContent=`${spec?.name || 'Bud'} is toast.`; burnOverlay.classList.add('show'); burnOverlay.setAttribute('aria-hidden','false');
  setTimeout(()=>{burnOverlay.classList.remove('show');burnOverlay.setAttribute('aria-hidden','true');},2200);
}

function connectEvents(){
  closeEvents(); if(!identity.code||!identity.playerId) return;
  eventSource=new EventSource(`/api/games/${encodeURIComponent(identity.code)}/events?playerId=${encodeURIComponent(identity.playerId)}`);
  eventSource.addEventListener('state',e=>{
    const next=JSON.parse(e.data); const event=next.lastEvent;
    if(event?.id && event.id!==lastEventId && event.type==='sunk' && event.byPlayerId===identity.playerId){ showBurn(event); }
    if(event?.id) lastEventId=event.id;
    state=next; renderGame();
  });
  eventSource.onerror=()=>{};
}
function closeEvents(){ if(eventSource){eventSource.close();eventSource=null;} }

async function enterGame(code, playerId){
  identity.code=code.toUpperCase(); identity.playerId=playerId; saveSession();
  state=await api(`/api/games/${identity.code}?playerId=${encodeURIComponent(identity.playerId)}`);
  if(!state.me.ready) emptyPlacement();
  renderGame(); connectEvents();
}

app.addEventListener('click', async e=>{
  const btn=e.target.closest('button'); if(!btn) return;
  try{
    if(btn.dataset.action==='lobby'){ history.pushState({},'', '/'); return renderLobby(); }
    if(btn.dataset.action==='create'){
      const name=document.querySelector('#createName')?.value.trim(); if(!name) return toast('Enter a player name.');
      const out=await api('/api/games',{method:'POST',body:JSON.stringify({name})}); identity.name=name; await enterGame(out.code,out.playerId); history.pushState({},'',`/?room=${out.code}`);
    }
    if(btn.dataset.action==='join'){
      const name=document.querySelector('#joinName')?.value.trim(); const code=document.querySelector('#joinCode')?.value.trim().toUpperCase(); if(!name||code.length!==6) return toast('Enter your name and 6-character room code.');
      const out=await api(`/api/games/${code}/join`,{method:'POST',body:JSON.stringify({name})}); identity.name=name; await enterGame(out.code,out.playerId); history.pushState({},'',`/?room=${out.code}`);
    }
    if(btn.dataset.action==='resume'){ await enterGame(btn.dataset.code,identity.playerId); history.pushState({},'',`/?room=${btn.dataset.code}`); }
    if(btn.dataset.ship){ placement.selected=btn.dataset.ship; return renderGame(); }
    if(btn.dataset.action==='rotate'){ placement.horizontal=!placement.horizontal; return renderGame(); }
    if(btn.dataset.action==='random'){ return randomFleet(); }
    if(btn.dataset.place){ const [r,c]=btn.dataset.place.split(',').map(Number); return placeAt(r,c); }
    if(btn.dataset.action==='lock'){
      if(placement.fleet.length!==FLEET.length) return toast('Place all five leaves first.');
      state=await api(`/api/games/${state.code}/place`,{method:'POST',body:JSON.stringify({playerId:identity.playerId,fleet:placement.fleet})}); renderGame();
    }
    if(btn.dataset.fire){
      if(state.status!=='playing'||state.turnPlayerId!==state.me.id) return;
      const [row,col]=btn.dataset.fire.split(',').map(Number);
      state=await api(`/api/games/${state.code}/fire`,{method:'POST',body:JSON.stringify({playerId:identity.playerId,row,col})}); renderGame();
    }
  }catch(err){ toast(err.message); }
});

app.addEventListener('submit', async e=>{
  if(e.target.id!=='chatForm') return; e.preventDefault(); const input=document.querySelector('#chatInput'); const text=input.value.trim(); if(!text) return;
  try{ await api(`/api/games/${state.code}/chat`,{method:'POST',body:JSON.stringify({playerId:identity.playerId,text})}); input.value=''; }
  catch(err){toast(err.message);}
});

window.addEventListener('popstate',()=>renderLobby());
(async function boot(){
  const room=new URLSearchParams(location.search).get('room');
  if(room&&identity.playerId){ try{return await enterGame(room,identity.playerId);}catch{} }
  await renderLobby();
})();
