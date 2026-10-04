const board = document.querySelector('#board');
const deckPicker = document.querySelector('#deck-picker');
const deckTitle = document.querySelector('#deck-title');
const deckDescription = document.querySelector('#deck-description');
const movesEl = document.querySelector('#moves');
const timeEl = document.querySelector('#time');
const pairsEl = document.querySelector('#pairs');
const bestEl = document.querySelector('#best');
const streakEl = document.querySelector('#streak');
const learnNote = document.querySelector('#learn-note');
const restartButton = document.querySelector('#restart');
const playAgainButton = document.querySelector('#play-again');
const completePanel = document.querySelector('#complete');
const completeCopy = document.querySelector('#complete-copy');
const roundStatus = document.querySelector('#round-status');

let data;
let activeDeck;
let cards = [];
let openCards = [];
let locked = false;
let moves = 0;
let matches = 0;
let streak = 0;
let bestStreak = 0;
let roundStarted = false;
let elapsedMs = 0;
let runningSince = null;
let timerId = null;
let roundToken = 0;
let restartArmedUntil = 0;
let restartResetTimer = null;

function readEmbeddedData() {
  const node = document.querySelector('#strain-match-data');
  if (!node) throw new Error('Embedded Strain Match data is missing.');
  const parsed = JSON.parse(node.textContent || '{}');
  if (!Array.isArray(parsed.decks) || !parsed.decks.length) throw new Error('Strain Match data contains no decks.');
  for (const deck of parsed.decks) {
    if (!deck?.id || !deck?.title || !Array.isArray(deck.pairs) || deck.pairs.length < 2) throw new Error('A Strain Match deck is incomplete.');
    const pairIds = new Set();
    for (const pair of deck.pairs) {
      if (!pair?.id || !pair?.term || !pair?.clue || !pair?.note) throw new Error(`${deck.title} contains an incomplete pair.`);
      if (pairIds.has(pair.id)) throw new Error(`${deck.title} contains a duplicate pair id.`);
      pairIds.add(pair.id);
    }
  }
  return parsed;
}

function shuffle(items) {
  const output = [...items];
  for (let i = output.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [output[i], output[j]] = [output[j], output[i]];
  }
  return output;
}

const formatTime = (seconds) => `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`;
const elapsedMilliseconds = () => elapsedMs + (runningSince === null ? 0 : Math.max(0, Date.now() - runningSince));
const elapsedSeconds = () => Math.floor(elapsedMilliseconds() / 1000);
const bestKey = () => `dtf-strain-match-best-${activeDeck.id}`;

function isValidResult(value) {
  return value && Number.isInteger(value.moves) && value.moves >= 0 && Number.isInteger(value.time) && value.time >= 0;
}

function readBest() {
  try {
    const value = JSON.parse(globalThis.localStorage?.getItem(bestKey()) || 'null');
    return isValidResult(value) ? value : null;
  } catch {
    return null;
  }
}

function isBetterResult(candidate, current) {
  if (!current) return true;
  if (candidate.moves !== current.moves) return candidate.moves < current.moves;
  return candidate.time < current.time;
}

function writeBest(result) {
  const current = readBest();
  const next = isBetterResult(result, current) ? result : current;
  try { globalThis.localStorage?.setItem(bestKey(), JSON.stringify(next)); } catch {}
  return next;
}

function updateScore() {
  movesEl.textContent = String(moves);
  timeEl.textContent = formatTime(elapsedSeconds());
  pairsEl.textContent = `${matches} / ${activeDeck.pairs.length}`;
  if (streakEl) {
    streakEl.textContent = String(streak);
    streakEl.parentElement?.setAttribute('data-hot', String(streak >= 2));
  }
  const best = readBest();
  bestEl.textContent = best ? `${best.moves} moves · ${formatTime(best.time)}` : '—';
}

function ensureTimerTicking() {
  if (timerId !== null) return;
  timerId = window.setInterval(updateScore, 500);
}

function startTimer() {
  if (!roundStarted) roundStarted = true;
  if (runningSince !== null || document.hidden) return;
  runningSince = Date.now();
  ensureTimerTicking();
  if (roundStatus) roundStatus.textContent = 'Round live';
}

function pauseTimer(reason = 'paused') {
  if (runningSince !== null) {
    elapsedMs += Math.max(0, Date.now() - runningSince);
    runningSince = null;
  }
  if (timerId !== null) window.clearInterval(timerId);
  timerId = null;
  updateScore();
  if (roundStatus && roundStarted && matches < activeDeck.pairs.length) roundStatus.textContent = reason;
}

function resumeTimer() {
  if (!roundStarted || matches >= activeDeck.pairs.length || runningSince !== null || document.hidden) return;
  runningSince = Date.now();
  ensureTimerTicking();
  if (roundStatus) roundStatus.textContent = 'Round live';
}

function stopTimer() {
  pauseTimer('Round complete');
}

function buildCards(deck) {
  return shuffle(deck.pairs.flatMap((pair) => [
    { key: `${pair.id}-term`, pairId: pair.id, kind: 'term', text: pair.term, note: pair.note },
    { key: `${pair.id}-clue`, pairId: pair.id, kind: 'clue', text: pair.clue, note: pair.note }
  ]));
}

function escapeHtml(value) {
  return String(value).replace(/[&<>'"]/g, (character) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' }[character]));
}

function renderBoard() {
  board.replaceChildren();
  board.setAttribute('aria-busy', 'false');
  cards.forEach((card, index) => {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'match-card';
    button.dataset.key = card.key;
    button.dataset.kind = card.kind;
    button.setAttribute('aria-label', `Hidden Strain Match card ${index + 1} of ${cards.length}`);
    button.setAttribute('aria-pressed', 'false');
    button.innerHTML = `<span class="card-inner card-front" aria-hidden="true"></span><span class="card-inner card-back">${escapeHtml(card.text)}</span>`;
    button.addEventListener('click', () => reveal(card, button, index));
    board.append(button);
  });
}

function clearRestartArm() {
  restartArmedUntil = 0;
  clearTimeout(restartResetTimer);
  restartResetTimer = null;
  restartButton.textContent = 'Shuffle & restart';
  restartButton.removeAttribute('data-armed');
}

function requestRestart() {
  const hasProgress = roundStarted && matches < activeDeck.pairs.length && (moves > 0 || openCards.length > 0 || matches > 0);
  if (!hasProgress) {
    resetRound();
    return;
  }
  const now = Date.now();
  if (now > restartArmedUntil) {
    restartArmedUntil = now + 3500;
    restartButton.textContent = 'Confirm restart';
    restartButton.dataset.armed = 'true';
    if (roundStatus) roundStatus.textContent = 'Restart armed';
    clearTimeout(restartResetTimer);
    restartResetTimer = setTimeout(clearRestartArm, 3600);
    return;
  }
  resetRound();
}

function reveal(card, button, index) {
  if (locked || button.classList.contains('revealed') || button.classList.contains('matched')) return;
  startTimer();
  button.classList.add('revealed');
  button.setAttribute('aria-label', `${card.text}. Card ${index + 1} of ${cards.length}`);
  button.setAttribute('aria-pressed', 'true');
  openCards.push({ card, button, index });
  if (openCards.length < 2) return;

  moves += 1;
  const [first, second] = openCards;
  const isMatch = first.card.pairId === second.card.pairId && first.card.kind !== second.card.kind;
  if (isMatch) {
    first.button.classList.add('matched', 'match-pop');
    second.button.classList.add('matched', 'match-pop');
    first.button.disabled = true;
    second.button.disabled = true;
    openCards = [];
    matches += 1;
    streak += 1;
    bestStreak = Math.max(bestStreak, streak);
    learnNote.textContent = `${streak > 1 ? `${streak}× streak · ` : ''}${first.card.note}`;
    if (roundStatus) roundStatus.textContent = streak > 1 ? `${streak}× match streak` : 'Pair matched';
    updateScore();
    if (matches === activeDeck.pairs.length) finishRound();
    return;
  }

  streak = 0;
  locked = true;
  board.setAttribute('aria-busy', 'true');
  const token = roundToken;
  const mismatched = [...openCards];
  openCards = [];
  for (const entry of mismatched) entry.button.classList.add('mismatch');
  if (roundStatus) roundStatus.textContent = 'No match';
  window.setTimeout(() => {
    if (token !== roundToken) return;
    for (const entry of mismatched) {
      entry.button.classList.remove('revealed', 'mismatch');
      entry.button.setAttribute('aria-label', `Hidden Strain Match card ${entry.index + 1} of ${cards.length}`);
      entry.button.setAttribute('aria-pressed', 'false');
    }
    locked = false;
    board.setAttribute('aria-busy', 'false');
    if (roundStatus) roundStatus.textContent = 'Round live';
    updateScore();
  }, 650);
  updateScore();
}

function finishRound() {
  stopTimer();
  const result = { moves, time: elapsedSeconds() };
  const best = writeBest(result);
  updateScore();
  completeCopy.textContent = `Solved ${matches} pairs in ${moves} moves and ${formatTime(result.time)}. Best streak: ${bestStreak}. Best result: ${best.moves} moves · ${formatTime(best.time)}.`;
  completePanel.hidden = false;
  if (!completePanel.hasAttribute('tabindex')) completePanel.setAttribute('tabindex', '-1');
  board.classList.add('round-complete');
  const reducedMotion = globalThis.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false;
  completePanel.scrollIntoView({ behavior: reducedMotion ? 'auto' : 'smooth', block: 'nearest' });
  try { completePanel.focus({ preventScroll: true }); }
  catch { completePanel.focus(); }
}

function selectDeck(deckId) {
  activeDeck = data.decks.find((deck) => deck.id === deckId) || data.decks[0];
  document.documentElement.dataset.deck = activeDeck.id;
  for (const button of deckPicker.querySelectorAll('button')) button.setAttribute('aria-pressed', String(button.dataset.deck === activeDeck.id));
  deckTitle.textContent = activeDeck.title;
  deckDescription.textContent = activeDeck.description;
  resetRound();
}

function resetRound() {
  roundToken += 1;
  pauseTimer('Ready');
  roundStarted = false;
  elapsedMs = 0;
  runningSince = null;
  moves = 0;
  matches = 0;
  streak = 0;
  bestStreak = 0;
  openCards = [];
  locked = false;
  clearRestartArm();
  completePanel.hidden = true;
  board.classList.remove('round-complete');
  board.setAttribute('aria-busy', 'false');
  learnNote.textContent = 'Solve a pair to reveal a quick learning note.';
  if (roundStatus) roundStatus.textContent = 'Ready';
  cards = buildCards(activeDeck);
  renderBoard();
  updateScore();
}

function renderDeckPicker() {
  deckPicker.replaceChildren();
  for (const deck of data.decks) {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'deck-button';
    button.dataset.deck = deck.id;
    button.textContent = deck.title;
    button.setAttribute('aria-pressed', 'false');
    button.addEventListener('click', () => selectDeck(deck.id));
    deckPicker.append(button);
  }
}

// BEGIN STRAIN MATCH AGENT BRIDGE
const STRAIN_MATCH_AGENT_VERSION = 'strain-match-agent-bridge-v1';
const STRAIN_MATCH_AGENT_MAX_EVENTS = 32;
const STRAIN_MATCH_AGENT_STALL_MS = 8000;
const strainMatchAgentTelemetry = { actions: [], errors: [], lastProgressKey: '', lastProgressAt: 0, lastActionAt: 0 };

function strainMatchAgentNow() {
  return typeof performance !== 'undefined' && typeof performance.now === 'function' ? performance.now() : Date.now();
}

function pushStrainMatchAgentEvent(list, event) {
  list.push(Object.freeze(event));
  if (list.length > STRAIN_MATCH_AGENT_MAX_EVENTS) list.splice(0, list.length - STRAIN_MATCH_AGENT_MAX_EVENTS);
}

function recordStrainMatchAgentAction(action, detail = null) {
  const now = strainMatchAgentNow();
  strainMatchAgentTelemetry.lastActionAt = now;
  pushStrainMatchAgentEvent(strainMatchAgentTelemetry.actions, { atMs: Math.round(now), action, detail });
}

function recordStrainMatchAgentError(kind, message, source = null) {
  pushStrainMatchAgentEvent(strainMatchAgentTelemetry.errors, {
    atMs: Math.round(strainMatchAgentNow()),
    kind,
    message: String(message || kind || 'unknown error').slice(0, 500),
    source: source ? String(source).slice(0, 500) : null
  });
}

function strainMatchAgentCardState() {
  const buttons = [...board.querySelectorAll('.match-card')];
  return buttons.map((button, index) => {
    const matched = button.classList.contains('matched');
    const revealed = matched || button.classList.contains('revealed');
    return {
      index,
      state: matched ? 'matched' : revealed ? 'revealed' : 'hidden',
      text: revealed ? (cards[index]?.text || '') : null,
      kind: revealed ? (cards[index]?.kind || null) : null,
      disabled: Boolean(button.disabled)
    };
  });
}

function observeStrainMatchAgentProgress() {
  const progressKey = [
    activeDeck?.id || '',
    roundToken,
    moves,
    matches,
    streak,
    openCards.length,
    locked ? 1 : 0,
    roundStarted ? 1 : 0,
    completePanel.hidden ? 0 : 1
  ].join('|');
  if (progressKey !== strainMatchAgentTelemetry.lastProgressKey) {
    strainMatchAgentTelemetry.lastProgressKey = progressKey;
    strainMatchAgentTelemetry.lastProgressAt = strainMatchAgentNow();
  }
}

function strainMatchAgentTelemetrySnapshot() {
  observeStrainMatchAgentProgress();
  const now = strainMatchAgentNow();
  const noProgressMs = strainMatchAgentTelemetry.lastProgressAt ? Math.max(0, now - strainMatchAgentTelemetry.lastProgressAt) : 0;
  const sinceActionMs = strainMatchAgentTelemetry.lastActionAt ? Math.max(0, now - strainMatchAgentTelemetry.lastActionAt) : 0;
  const actionPending = strainMatchAgentTelemetry.lastActionAt > strainMatchAgentTelemetry.lastProgressAt;
  return {
    errors: strainMatchAgentTelemetry.errors.slice(),
    recentActions: strainMatchAgentTelemetry.actions.slice(),
    noProgressMs: Math.round(noProgressMs),
    sinceActionMs: Math.round(sinceActionMs),
    stallSuspected: Boolean(actionPending && sinceActionMs >= STRAIN_MATCH_AGENT_STALL_MS && noProgressMs >= STRAIN_MATCH_AGENT_STALL_MS),
    stallThresholdMs: STRAIN_MATCH_AGENT_STALL_MS
  };
}

function strainMatchAgentSnapshot() {
  const cardStates = activeDeck ? strainMatchAgentCardState() : [];
  const completed = Boolean(activeDeck && matches === activeDeck.pairs.length);
  const restartArmed = restartArmedUntil > Date.now();
  return {
    version: STRAIN_MATCH_AGENT_VERSION,
    ready: Boolean(data && activeDeck && cards.length),
    deck: activeDeck ? {
      id: activeDeck.id,
      title: activeDeck.title,
      pairCount: activeDeck.pairs.length,
      available: data.decks.map((deck) => ({ id: deck.id, title: deck.title }))
    } : null,
    round: {
      started: Boolean(roundStarted),
      locked: Boolean(locked),
      moves,
      matches,
      streak,
      bestStreak,
      elapsedSeconds: elapsedSeconds(),
      completed,
      restartArmed,
      openCount: openCards.length
    },
    cards: cardStates,
    legalActions: completed
      ? ['play-again','select-deck']
      : locked
        ? []
        : ['reveal','restart','select-deck'],
    telemetry: strainMatchAgentTelemetrySnapshot()
  };
}

function revealStrainMatchAgentCard(index) {
  const normalized = Number(index);
  if (!Number.isInteger(normalized) || normalized < 0 || normalized >= cards.length) {
    throw new Error(`Unsupported Strain Match card index: ${index}`);
  }
  if (locked || matches === activeDeck.pairs.length) return false;
  const button = [...board.querySelectorAll('.match-card')][normalized];
  if (!button || button.disabled || button.classList.contains('revealed') || button.classList.contains('matched')) return false;
  recordStrainMatchAgentAction('reveal', normalized);
  button.click();
  return true;
}

function selectStrainMatchAgentDeck(deckId) {
  const normalized = String(deckId || '');
  if (!data?.decks?.some((deck) => deck.id === normalized)) throw new Error(`Unsupported Strain Match deck: ${deckId}`);
  const button = [...deckPicker.querySelectorAll('button')].find((candidate) => candidate.dataset.deck === normalized);
  if (!button) return false;
  recordStrainMatchAgentAction('select-deck', normalized);
  button.click();
  return true;
}

function installStrainMatchAgentTelemetry() {
  if (typeof window?.addEventListener !== 'function') return;
  window.addEventListener('error', (event) => {
    const target = event?.target;
    const resource = target && target !== window && (target.currentSrc || target.src || target.href);
    if (resource) recordStrainMatchAgentError('resource-error', 'Browser resource failed to load', resource);
    else recordStrainMatchAgentError('runtime-error', event?.message || event?.error?.message || 'Browser runtime error', event?.filename || null);
  }, true);
  window.addEventListener('unhandledrejection', (event) => {
    recordStrainMatchAgentError('unhandled-rejection', event?.reason?.message || event?.reason || 'Unhandled promise rejection');
  });
}

function installStrainMatchAgentBridge() {
  installStrainMatchAgentTelemetry();
  const api = Object.freeze({
    version: STRAIN_MATCH_AGENT_VERSION,
    snapshot: strainMatchAgentSnapshot,
    reveal: revealStrainMatchAgentCard,
    selectDeck: selectStrainMatchAgentDeck,
    restart: () => {
      if (!activeDeck || matches === activeDeck.pairs.length) return false;
      recordStrainMatchAgentAction('restart');
      restartButton.click();
      return true;
    },
    playAgain: () => {
      if (!activeDeck || matches !== activeDeck.pairs.length) return false;
      recordStrainMatchAgentAction('play-again');
      playAgainButton.click();
      return true;
    },
    telemetry: strainMatchAgentTelemetrySnapshot
  });
  Object.defineProperty(window, '__STRAIN_MATCH_AGENT__', { value: api, enumerable: false, configurable: false, writable: false });
  Object.defineProperty(window, '__STRAIN_MATCH_GAME_STATE__', { get: strainMatchAgentSnapshot, enumerable: false, configurable: false });
  document.documentElement.dataset.strainMatchAgentBridge = STRAIN_MATCH_AGENT_VERSION;
  strainMatchAgentTelemetry.lastProgressAt = strainMatchAgentNow();
  return api;
}

installStrainMatchAgentBridge();
// END STRAIN MATCH AGENT BRIDGE

restartButton.addEventListener('click', requestRestart);
playAgainButton.addEventListener('click', resetRound);
document.addEventListener('visibilitychange', () => {
  if (!roundStarted || matches >= activeDeck.pairs.length) return;
  if (document.hidden) pauseTimer('Timer paused while hidden');
  else resumeTimer();
});

try {
  data = readEmbeddedData();
  renderDeckPicker();
  selectDeck(data.decks[0].id);
} catch (error) {
  board.innerHTML = `<p role="alert">Strain Match could not load its game data. ${escapeHtml(error.message)}</p>`;
  deckTitle.textContent = 'Strain Match could not start';
  deckDescription.textContent = 'Refresh the page or return to the Game Hub.';
  console.error(error);
}
