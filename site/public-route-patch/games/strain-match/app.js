const board = document.querySelector('#board');
const deckPicker = document.querySelector('#deck-picker');
const deckTitle = document.querySelector('#deck-title');
const deckDescription = document.querySelector('#deck-description');
const movesEl = document.querySelector('#moves');
const timeEl = document.querySelector('#time');
const pairsEl = document.querySelector('#pairs');
const bestEl = document.querySelector('#best');
const learnNote = document.querySelector('#learn-note');
const restartButton = document.querySelector('#restart');
const playAgainButton = document.querySelector('#play-again');
const completePanel = document.querySelector('#complete');
const completeCopy = document.querySelector('#complete-copy');

let data;
let activeDeck;
let cards = [];
let openCards = [];
let locked = false;
let moves = 0;
let matches = 0;
let startedAt = null;
let timerId = null;

const shuffle = (items) => {
  const output = [...items];
  for (let i = output.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [output[i], output[j]] = [output[j], output[i]];
  }
  return output;
};

const formatTime = (seconds) => `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`;
const elapsedSeconds = () => startedAt ? Math.floor((Date.now() - startedAt) / 1000) : 0;
const bestKey = () => `dtf-strain-match-best-${activeDeck.id}`;

function readBest() {
  try { return JSON.parse(localStorage.getItem(bestKey()) || 'null'); } catch { return null; }
}

function writeBest(result) {
  const current = readBest();
  const next = {
    moves: current?.moves ? Math.min(current.moves, result.moves) : result.moves,
    time: current?.time ? Math.min(current.time, result.time) : result.time
  };
  try { localStorage.setItem(bestKey(), JSON.stringify(next)); } catch {}
  return next;
}

function updateScore() {
  movesEl.textContent = String(moves);
  timeEl.textContent = formatTime(elapsedSeconds());
  pairsEl.textContent = `${matches} / ${activeDeck.pairs.length}`;
  const best = readBest();
  bestEl.textContent = best ? `${best.moves} moves · ${formatTime(best.time)}` : '—';
}

function startTimer() {
  if (startedAt) return;
  startedAt = Date.now();
  timerId = window.setInterval(updateScore, 500);
}

function stopTimer() {
  if (timerId) window.clearInterval(timerId);
  timerId = null;
}

function buildCards(deck) {
  return shuffle(deck.pairs.flatMap((pair) => [
    { key: `${pair.id}-term`, pairId: pair.id, kind: 'term', text: pair.term, note: pair.note },
    { key: `${pair.id}-clue`, pairId: pair.id, kind: 'clue', text: pair.clue, note: pair.note }
  ]));
}

function renderBoard() {
  board.innerHTML = '';
  for (const card of cards) {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'match-card';
    button.dataset.key = card.key;
    button.setAttribute('aria-label', 'Hidden Strain Match card');
    button.innerHTML = `<span class="card-inner card-front" aria-hidden="true">✦</span><span class="card-inner card-back">${escapeHtml(card.text)}</span>`;
    button.addEventListener('click', () => reveal(card, button));
    board.append(button);
  }
}

function escapeHtml(value) {
  return String(value).replace(/[&<>'"]/g, (character) => ({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[character]));
}

function reveal(card, button) {
  if (locked || button.classList.contains('revealed') || button.classList.contains('matched')) return;
  startTimer();
  button.classList.add('revealed');
  button.setAttribute('aria-label', card.text);
  openCards.push({ card, button });
  if (openCards.length < 2) return;

  moves += 1;
  const [first, second] = openCards;
  const isMatch = first.card.pairId === second.card.pairId && first.card.kind !== second.card.kind;
  if (isMatch) {
    first.button.classList.add('matched');
    second.button.classList.add('matched');
    first.button.disabled = true;
    second.button.disabled = true;
    openCards = [];
    matches += 1;
    learnNote.textContent = first.card.note;
    updateScore();
    if (matches === activeDeck.pairs.length) finishRound();
    return;
  }

  locked = true;
  window.setTimeout(() => {
    for (const entry of openCards) {
      entry.button.classList.remove('revealed');
      entry.button.setAttribute('aria-label', 'Hidden Strain Match card');
    }
    openCards = [];
    locked = false;
    updateScore();
  }, 650);
  updateScore();
}

function finishRound() {
  stopTimer();
  const result = { moves, time: elapsedSeconds() };
  const best = writeBest(result);
  updateScore();
  completeCopy.textContent = `Solved ${matches} pairs in ${moves} moves and ${formatTime(result.time)}. Best: ${best.moves} moves · ${formatTime(best.time)}.`;
  completePanel.hidden = false;
  completePanel.scrollIntoView({ behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth', block: 'nearest' });
}

function selectDeck(deckId) {
  activeDeck = data.decks.find((deck) => deck.id === deckId) || data.decks[0];
  for (const button of deckPicker.querySelectorAll('button')) button.setAttribute('aria-pressed', String(button.dataset.deck === activeDeck.id));
  deckTitle.textContent = activeDeck.title;
  deckDescription.textContent = activeDeck.description;
  resetRound();
}

function resetRound() {
  stopTimer();
  startedAt = null;
  moves = 0;
  matches = 0;
  openCards = [];
  locked = false;
  completePanel.hidden = true;
  learnNote.textContent = 'Solve a pair to reveal a quick learning note.';
  cards = buildCards(activeDeck);
  renderBoard();
  updateScore();
}

function renderDeckPicker() {
  deckPicker.innerHTML = '';
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

async function boot() {
  const response = await fetch('./data/decks.json', { cache: 'no-store' });
  if (!response.ok) throw new Error(`Strain Match data failed to load (${response.status})`);
  data = await response.json();
  if (!Array.isArray(data.decks) || !data.decks.length) throw new Error('Strain Match data contains no decks');
  renderDeckPicker();
  selectDeck(data.decks[0].id);
}

restartButton.addEventListener('click', resetRound);
playAgainButton.addEventListener('click', resetRound);

boot().catch((error) => {
  board.innerHTML = `<p role="alert">Strain Match could not load its game data. ${escapeHtml(error.message)}</p>`;
  console.error(error);
});
