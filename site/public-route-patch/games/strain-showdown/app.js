import {
  FAMILY_PASSIVES,
  STARTING_GARDEN,
  createGame,
  legalPlay,
  playCard,
  attack,
  endTurn,
  chooseCpuAction
} from './engine.mjs';

const $ = (selector) => document.querySelector(selector);
const $$ = (selector) => [...document.querySelectorAll(selector)];
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const FAMILY_IDS = ['kush', 'haze', 'skunk', 'gas', 'cookies', 'fruit', 'purple', 'frost'];
const RECORD_KEY = 'dtf-strain-showdown-record';

const els = {
  familyScreen: $('#familyScreen'), battleScreen: $('#battleScreen'), familyGrid: $('#familyGrid'), recordStrip: $('#recordStrip'),
  runtimeStatus: $('#runtimeStatus'), cpuFamilyName: $('#cpuFamilyName'), playerFamilyName: $('#playerFamilyName'), cpuGarden: $('#cpuGarden'),
  playerGarden: $('#playerGarden'), cpuGardenBar: $('#cpuGardenBar'), playerGardenBar: $('#playerGardenBar'), cpuFocus: $('#cpuFocus'),
  playerFocus: $('#playerFocus'), cpuDeck: $('#cpuDeck'), playerDeck: $('#playerDeck'), turnBadge: $('#turnBadge'), roundLabel: $('#roundLabel'),
  matchupLabel: $('#matchupLabel'), cpuPassive: $('#cpuPassive'), cpuPassiveText: $('#cpuPassiveText'), playerPassive: $('#playerPassive'),
  playerPassiveText: $('#playerPassiveText'), cpuLanes: $('#cpuLanes'), playerLanes: $('#playerLanes'), hand: $('#hand'), selectionHint: $('#selectionHint'),
  cancelSelection: $('#cancelSelection'), endTurnButton: $('#endTurnButton'), battleLog: $('#battleLog'), rulesButton: $('#rulesButton'),
  rulesDialog: $('#rulesDialog'), closeRules: $('#closeRules'), soundButton: $('#soundButton'), toast: $('#toast'), restartButton: $('#restartButton'),
  resultOverlay: $('#resultOverlay'), resultTitle: $('#resultTitle'), resultText: $('#resultText'), resultStats: $('#resultStats'), rematchButton: $('#rematchButton'),
  changeFamilyButton: $('#changeFamilyButton'), arena: $('#arena')
};

let cards = [];
let families = [];
let state = null;
let selectedHandIndex = null;
let currentPlayerFamily = null;
let currentCpuFamily = null;
let cpuRunning = false;
let soundOn = true;
let toastTimer = null;
let audioContext = null;
let resultRecorded = false;
let resultRevealTimer = null;
let restartArmedUntil = 0;
let restartResetTimer = null;
let matchToken = 0;

const familyName = (id) => families.find((family) => family.id === id)?.name || id;

function readRecord() {
  try {
    const raw = globalThis.localStorage?.getItem(RECORD_KEY);
    const parsed = raw ? JSON.parse(raw) : null;
    return {
      wins: Number.isInteger(parsed?.wins) ? parsed.wins : 0,
      losses: Number.isInteger(parsed?.losses) ? parsed.losses : 0,
      draws: Number.isInteger(parsed?.draws) ? parsed.draws : 0
    };
  } catch {
    return { wins: 0, losses: 0, draws: 0 };
  }
}

function writeRecord(record) {
  try {
    globalThis.localStorage?.setItem(RECORD_KEY, JSON.stringify(record));
  } catch (error) {
    console.warn('Strain Showdown record storage unavailable.', error);
  }
  renderRecord();
}

function renderRecord() {
  const record = readRecord();
  els.recordStrip.textContent = `Prototype record: ${record.wins} W / ${record.losses} L${record.draws ? ` / ${record.draws} D` : ''}`;
}

function sound(type = 'tap') {
  if (!soundOn) return;
  try {
    const AudioContextClass = globalThis.AudioContext || globalThis.webkitAudioContext;
    if (!AudioContextClass) return;
    audioContext ||= new AudioContextClass();
    const now = audioContext.currentTime;
    const oscillator = audioContext.createOscillator();
    const gain = audioContext.createGain();
    const settings = {
      tap: [240, .035, .025], play: [330, .06, .04], evolve: [520, .11, .05], hit: [120, .07, .05], win: [660, .18, .055], lose: [150, .18, .05]
    }[type] || [240, .04, .03];
    oscillator.frequency.setValueAtTime(settings[0], now);
    if (type === 'evolve' || type === 'win') oscillator.frequency.exponentialRampToValueAtTime(settings[0] * 1.5, now + settings[1]);
    gain.gain.setValueAtTime(settings[2], now);
    gain.gain.exponentialRampToValueAtTime(.0001, now + settings[1]);
    oscillator.connect(gain).connect(audioContext.destination);
    oscillator.start(now);
    oscillator.stop(now + settings[1]);
  } catch {}
}

function showToast(message) {
  els.toast.textContent = message;
  els.toast.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => els.toast.classList.remove('show'), 1900);
}

function safeRandomIndex(length) {
  if (length <= 1) return 0;
  try {
    const values = new Uint32Array(1);
    globalThis.crypto?.getRandomValues?.(values);
    if (values[0] || values[0] === 0) return values[0] % length;
  } catch {}
  return Math.floor(Math.random() * length);
}

function nextMatchSeed() {
  try {
    const values = new Uint32Array(1);
    globalThis.crypto?.getRandomValues?.(values);
    if (values[0]) return values[0];
  } catch {}
  return Date.now();
}

function renderFamilyChoices() {
  els.familyGrid.innerHTML = families.map((family) => {
    const passive = FAMILY_PASSIVES[family.id];
    return `<button class="family-choice" data-family="${family.id}" type="button">
      <span class="section-kicker">${family.identity.replaceAll('-', ' ')}</span>
      <div class="family-name">${family.name}</div>
      <p>${family.design}</p>
      <strong>${passive.name} <span>→</span></strong>
    </button>`;
  }).join('');
  $$('.family-choice').forEach((button) => button.addEventListener('click', () => startNewMatch(button.dataset.family)));
}

function chooseCpuFamily(playerFamily) {
  const options = families.filter((family) => family.id !== playerFamily);
  return options[safeRandomIndex(options.length)].id;
}

function clearRestartArm() {
  restartArmedUntil = 0;
  clearTimeout(restartResetTimer);
  restartResetTimer = null;
  if (els.restartButton) els.restartButton.textContent = 'Restart Match';
}

function startNewMatch(playerFamily, cpuFamily = null) {
  matchToken += 1;
  clearTimeout(resultRevealTimer);
  resultRevealTimer = null;
  resultRecorded = false;
  clearRestartArm();
  currentPlayerFamily = playerFamily;
  currentCpuFamily = cpuFamily || chooseCpuFamily(playerFamily);
  state = createGame({ cards, playerFamily, cpuFamily: currentCpuFamily, seed: nextMatchSeed() });
  selectedHandIndex = null;
  cpuRunning = false;
  els.resultOverlay.hidden = true;
  els.familyScreen.hidden = true;
  els.battleScreen.hidden = false;
  sound('play');
  render();
  globalThis.scrollTo?.({ top: 0, behavior: 'smooth' });
}

function cardMarkup(card, { unit = false, side = 'player', lane = -1, handIndex = -1, playable = true } = {}) {
  const selected = !unit && selectedHandIndex === handIndex;
  const canAttack = unit && side === 'player' && state?.turn === 'player' && !state?.winner && !cpuRunning && !card.exhausted;
  const vigorText = unit ? `${Math.max(0, card.currentVigor)}/${card.maxVigor}` : `${card.vigor}`;
  const shield = unit && card.shield ? `<span class="shield-pill">Shield ${card.shield}</span>` : '';
  const classes = ['card', selected ? 'selected' : '', unit && card.exhausted ? 'exhausted' : '', !unit && !playable ? 'unplayable' : ''].filter(Boolean).join(' ');
  const handAttrs = !unit
    ? `data-hand-index="${handIndex}" role="button" tabindex="0" aria-disabled="${playable ? 'false' : 'true'}" aria-label="${card.name}, Stage ${card.stage}, Vigor ${card.vigor}, Power ${card.power}${playable ? '' : ', currently not playable'}"`
    : '';
  return `<article class="${classes}" data-family="${card.family}" ${handAttrs}>
    <div class="card-head"><div class="card-stage"><span>Stage ${card.stage}</span><span>${card.stage === 1 ? 'Base' : card.stage === 2 ? 'Select' : 'Elite'}</span></div><h3>${card.name}</h3></div>
    <div class="card-art" aria-hidden="true"></div>
    <div class="card-body"><div class="stat-box">Vigor<b>${vigorText}</b></div><div class="stat-box">Power<b>${card.power}</b></div><div class="stat-box role-tag">Role<b>${card.roleTag.replaceAll('-', ' ')}</b></div></div>
    ${unit ? `<div class="unit-footer"><span>${card.nameSource === 'DTF Genetics catalog' ? 'DTF Genetics' : familyName(card.family)}</span>${shield}</div>` : ''}
    ${unit && side === 'player' ? `<button class="attack-button" type="button" data-attack-lane="${lane}" ${canAttack ? '' : 'disabled'}>Attack lane ${lane + 1}</button>` : ''}
  </article>`;
}

function laneMarkup(unit, side, lane) {
  const valid = side === 'player' && selectedHandIndex !== null && state?.turn === 'player' && !cpuRunning && legalPlay(state, 'player', selectedHandIndex, lane).ok;
  return `<div class="lane ${valid ? 'valid-target' : ''}" data-lane="${lane}" data-side="${side}">
    <span class="lane-index">0${lane + 1}</span>
    ${unit ? cardMarkup(unit, { unit: true, side, lane }) : `<span class="empty-lane">${valid ? 'Play here' : 'Open lane'}</span>`}
  </div>`;
}

function renderBoard() {
  els.cpuLanes.innerHTML = state.cpu.lanes.map((unit, lane) => laneMarkup(unit, 'cpu', lane)).join('');
  els.playerLanes.innerHTML = state.player.lanes.map((unit, lane) => laneMarkup(unit, 'player', lane)).join('');
  $$('#playerLanes .lane').forEach((lane) => lane.addEventListener('click', (event) => {
    if (event.target.closest('.attack-button')) return;
    if (selectedHandIndex === null || state.turn !== 'player' || cpuRunning) return;
    tryPlaySelected(Number(lane.dataset.lane));
  }));
  $$('[data-attack-lane]').forEach((button) => button.addEventListener('click', () => playerAttack(Number(button.dataset.attackLane))));
}

function playabilityForHand(index) {
  const checks = state.player.lanes.map((_, lane) => legalPlay(state, 'player', index, lane));
  return { playable: checks.some((check) => check.ok), reason: checks.find((check) => !check.ok)?.reason || 'No valid lane.' };
}

function renderHand() {
  els.hand.innerHTML = state.player.hand.map((card, index) => {
    const { playable } = playabilityForHand(index);
    return cardMarkup(card, { handIndex: index, playable });
  }).join('');

  $$('#hand .card').forEach((card) => {
    const select = () => {
      if (state.turn !== 'player' || cpuRunning || state.winner) return;
      const index = Number(card.dataset.handIndex);
      const status = playabilityForHand(index);
      if (!status.playable) {
        showToast(status.reason);
        sound('tap');
        return;
      }
      selectedHandIndex = index;
      sound('tap');
      render();
    };
    card.addEventListener('click', select);
    card.addEventListener('keydown', (event) => {
      if (event.key === 'Enter' || event.key === ' ') {
        event.preventDefault();
        select();
      }
    });
  });

  if (selectedHandIndex === null) {
    els.selectionHint.textContent = state.turn === 'cpu' || cpuRunning
      ? 'Rival turn in progress. Your hand will unlock when the rival finishes.'
      : 'Select a playable card, then choose a glowing lane.';
    els.cancelSelection.hidden = true;
  } else {
    const card = state.player.hand[selectedHandIndex];
    if (!card) {
      selectedHandIndex = null;
      renderHand();
      return;
    }
    els.selectionHint.textContent = `${card.name} selected — Stage ${card.stage} costs ${card.stage} Focus before family discounts. Choose a glowing lane.`;
    els.cancelSelection.hidden = false;
  }
}

function renderHud() {
  const playerPassive = FAMILY_PASSIVES[state.player.family];
  const cpuPassive = FAMILY_PASSIVES[state.cpu.family];
  els.playerFamilyName.textContent = familyName(state.player.family);
  els.cpuFamilyName.textContent = familyName(state.cpu.family);
  els.playerGarden.textContent = state.player.garden;
  els.cpuGarden.textContent = state.cpu.garden;
  els.playerGardenBar.style.width = `${Math.max(0, Math.min(100, state.player.garden / STARTING_GARDEN * 100))}%`;
  els.cpuGardenBar.style.width = `${Math.max(0, Math.min(100, state.cpu.garden / STARTING_GARDEN * 100))}%`;
  els.playerFocus.textContent = `Focus ${state.player.focus}/${state.player.maxFocus}`;
  els.cpuFocus.textContent = `Focus ${state.cpu.focus}/${state.cpu.maxFocus}`;
  els.playerDeck.textContent = `Deck ${state.player.deck.length}`;
  els.cpuDeck.textContent = `Deck ${state.cpu.deck.length}`;
  els.roundLabel.textContent = `Round ${state.round}`;
  els.matchupLabel.textContent = `${familyName(state.player.family)} vs ${familyName(state.cpu.family)}`;
  els.turnBadge.textContent = state.turn === 'player' ? 'YOUR TURN' : 'RIVAL TURN';
  els.turnBadge.classList.toggle('cpu', state.turn === 'cpu');
  els.playerPassive.textContent = playerPassive.name;
  els.playerPassiveText.textContent = playerPassive.text;
  els.cpuPassive.textContent = cpuPassive.name;
  els.cpuPassiveText.textContent = cpuPassive.text;
  els.endTurnButton.disabled = state.turn !== 'player' || cpuRunning || Boolean(state.winner);
  document.body.dataset.battleTurn = cpuRunning || state.turn === 'cpu' ? 'cpu' : 'player';
  els.arena.dataset.selecting = selectedHandIndex === null ? 'false' : 'true';
}

function renderLog() {
  els.battleLog.innerHTML = state.log.map((entry) => `<li><b>R${entry.round}</b><span>${entry.text}</span></li>`).join('');
}

function render() {
  if (!state) return;
  renderHud();
  renderBoard();
  renderHand();
  renderLog();
  if (state.winner) showResult();
}

function tryPlaySelected(lane) {
  if (selectedHandIndex === null) return;
  const result = playCard(state, 'player', selectedHandIndex, lane);
  if (!result.ok) {
    showToast(result.reason);
    sound('tap');
    return;
  }
  selectedHandIndex = null;
  sound(result.evolving ? 'evolve' : 'play');
  render();
}

function pulseLane(side, lane) {
  const target = document.querySelector(`#${side === 'cpu' ? 'cpuLanes' : 'playerLanes'} .lane[data-lane="${lane}"]`);
  if (!target) return;
  target.classList.remove('hit');
  requestAnimationFrame(() => target.classList.add('hit'));
  setTimeout(() => target.classList.remove('hit'), 320);
}

function playerAttack(lane) {
  if (state.turn !== 'player' || cpuRunning || state.winner) return;
  const result = attack(state, 'player', lane);
  if (!result.ok) {
    showToast(result.reason);
    return;
  }
  sound('hit');
  pulseLane('cpu', lane);
  render();
}

async function runCpuTurn(token) {
  if (state.winner || token !== matchToken) return;
  cpuRunning = true;
  selectedHandIndex = null;
  render();
  await sleep(420);
  if (token !== matchToken) return;

  let safety = 0;
  while (!state.winner && state.turn === 'cpu' && safety < 16 && token === matchToken) {
    safety += 1;
    const action = chooseCpuAction(state);
    if (action.type === 'play') {
      const result = playCard(state, 'cpu', action.cardIndex, action.lane);
      if (!result.ok) break;
      sound(result.evolving ? 'evolve' : 'play');
      render();
      await sleep(500);
      if (token !== matchToken) return;
      continue;
    }
    if (action.type === 'attack') {
      const result = attack(state, 'cpu', action.lane);
      if (!result.ok) break;
      sound('hit');
      pulseLane('player', action.lane);
      render();
      await sleep(500);
      if (token !== matchToken) return;
      continue;
    }
    break;
  }

  if (token !== matchToken) return;
  if (!state.winner && state.turn === 'cpu') endTurn(state, 'cpu');
  cpuRunning = false;
  render();
}

async function handleEndTurn() {
  if (!state || state.turn !== 'player' || cpuRunning || state.winner) return;
  sound('tap');
  endTurn(state, 'player');
  render();
  await runCpuTurn(matchToken);
}

function showResult() {
  if (resultRecorded || !els.resultOverlay.hidden) return;
  resultRecorded = true;
  const token = matchToken;
  const win = state.winner === 'player';
  const draw = state.winner === 'draw';
  const record = readRecord();
  if (win) record.wins += 1;
  else if (draw) record.draws += 1;
  else record.losses += 1;
  writeRecord(record);
  els.resultTitle.textContent = win ? 'SHOWDOWN WON' : draw ? 'DEAD EVEN' : 'RIVAL TAKES IT';
  els.resultText.textContent = `${state.reason}. ${familyName(state.player.family)} finished with ${state.player.garden} Garden; ${familyName(state.cpu.family)} finished with ${state.cpu.garden}.`;
  els.resultStats.innerHTML = `<div><b>${state.round}</b><span>Rounds</span></div><div><b>${state.player.stats.evolutions}</b><span>Evolutions</span></div><div><b>${state.player.stats.attacks}</b><span>Attacks</span></div><div><b>${state.player.stats.damage}</b><span>Damage</span></div><div><b>${state.player.stats.cardsLost}</b><span>Cards Lost</span></div><div><b>${record.wins}-${record.losses}</b><span>Record</span></div>`;
  sound(win ? 'win' : 'lose');
  clearTimeout(resultRevealTimer);
  resultRevealTimer = setTimeout(() => {
    if (token !== matchToken) return;
    els.resultOverlay.hidden = false;
    resultRevealTimer = null;
  }, 350);
}

function resetToFamilyScreen() {
  matchToken += 1;
  clearTimeout(resultRevealTimer);
  resultRevealTimer = null;
  resultRecorded = false;
  clearRestartArm();
  state = null;
  currentPlayerFamily = null;
  currentCpuFamily = null;
  selectedHandIndex = null;
  cpuRunning = false;
  els.resultOverlay.hidden = true;
  els.battleScreen.hidden = true;
  els.familyScreen.hidden = false;
  delete document.body.dataset.battleTurn;
  renderRecord();
  globalThis.scrollTo?.({ top: 0, behavior: 'smooth' });
}

function requestRestart() {
  if (!currentPlayerFamily) return;
  if (state?.winner) {
    startNewMatch(currentPlayerFamily, currentCpuFamily);
    return;
  }
  const now = Date.now();
  if (now > restartArmedUntil) {
    restartArmedUntil = now + 4000;
    els.restartButton.textContent = 'Confirm Restart';
    showToast('Tap Confirm Restart within 4 seconds to abandon this battle.');
    clearTimeout(restartResetTimer);
    restartResetTimer = setTimeout(clearRestartArm, 4100);
    return;
  }
  startNewMatch(currentPlayerFamily, currentCpuFamily);
}

els.endTurnButton.addEventListener('click', handleEndTurn);
els.cancelSelection.addEventListener('click', () => { selectedHandIndex = null; render(); });
els.restartButton.addEventListener('click', requestRestart);
els.rematchButton.addEventListener('click', () => { if (currentPlayerFamily) startNewMatch(currentPlayerFamily, currentCpuFamily); });
els.changeFamilyButton.addEventListener('click', resetToFamilyScreen);
els.rulesButton.addEventListener('click', () => {
  if (typeof els.rulesDialog.showModal === 'function') els.rulesDialog.showModal();
  else els.rulesDialog.setAttribute('open', '');
});
els.closeRules.addEventListener('click', () => {
  if (typeof els.rulesDialog.close === 'function') els.rulesDialog.close();
  else els.rulesDialog.removeAttribute('open');
});
els.rulesDialog.addEventListener('click', (event) => {
  if (event.target !== els.rulesDialog) return;
  if (typeof els.rulesDialog.close === 'function') els.rulesDialog.close();
  else els.rulesDialog.removeAttribute('open');
});
els.soundButton.addEventListener('click', () => {
  soundOn = !soundOn;
  els.soundButton.textContent = `Sound: ${soundOn ? 'On' : 'Off'}`;
  els.soundButton.setAttribute('aria-pressed', String(soundOn));
  if (soundOn) sound('tap');
});

async function loadLegacyData() {
  const [familiesResponse, ...rosterResponses] = await Promise.all([
    fetch('./data/families.json', { cache: 'no-store', credentials: 'same-origin' }),
    ...FAMILY_IDS.map((id) => fetch(`./data/roster/${id}.json`, { cache: 'no-store', credentials: 'same-origin' }))
  ]);
  if (!familiesResponse.ok || rosterResponses.some((response) => !response.ok)) throw new Error('Game data failed to load.');
  const loadedFamilies = await familiesResponse.json();
  const rosterGroups = await Promise.all(rosterResponses.map((response) => response.json()));
  return { families: loadedFamilies, cards: rosterGroups.flat(), source: 'legacy split roster fallback' };
}

async function loadGameData() {
  try {
    const response = await fetch('./data/browser-bundle.json', { cache: 'no-store', credentials: 'same-origin' });
    if (!response.ok) throw new Error(`bundle HTTP ${response.status}`);
    const bundle = await response.json();
    if (bundle.schemaVersion !== 1 || bundle.cardCount !== 96 || bundle.familyCount !== 8 || bundle.cards?.length !== 96 || bundle.families?.length !== 8) {
      throw new Error('canonical browser bundle is incomplete');
    }
    return { families: bundle.families, cards: bundle.cards, source: 'canonical one-file roster bundle' };
  } catch (error) {
    console.warn('Strain Showdown bundle unavailable; using split development data.', error);
    return loadLegacyData();
  }
}

async function boot() {
  try {
    const loaded = await loadGameData();
    families = loaded.families;
    cards = loaded.cards;
    const ids = new Set(families.map((family) => family.id));
    if (cards.length !== 96 || families.length !== 8 || FAMILY_IDS.some((id) => !ids.has(id))) throw new Error('Canonical roster is incomplete.');
    for (const familyId of FAMILY_IDS) {
      if (cards.filter((card) => card.family === familyId).length !== 12) throw new Error(`Canonical ${familyId} roster is incomplete.`);
    }
    renderRecord();
    renderFamilyChoices();
    if (els.runtimeStatus) els.runtimeStatus.textContent = `96 cards · 8 families · ${loaded.source}`;
  } catch (error) {
    if (els.runtimeStatus) els.runtimeStatus.textContent = 'Roster unavailable';
    els.familyGrid.innerHTML = `<div class="intro-panel"><h2>Game data could not load.</h2><p>${error.message}</p></div>`;
    console.error(error);
  }
}

boot();
