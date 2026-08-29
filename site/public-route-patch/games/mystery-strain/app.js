import {
  CASE_ALPHABET,
  askQuestion,
  createGame,
  gameScore,
  guessStrain,
  isValidCaseCode,
  normalizeCaseCode,
  questionsLeft
} from './engine.mjs';
import { rankedQuestionOptions } from './analysis.mjs';

const ui = {
  load: document.querySelector('#load-status'),
  setup: document.querySelector('#setup-panel'),
  game: document.querySelector('#game-panel'),
  result: document.querySelector('#result-panel'),
  code: document.querySelector('#case-code'),
  wild: document.querySelector('#wild-card'),
  start: document.querySelector('#start-game'),
  random: document.querySelector('#random-case'),
  share: document.querySelector('#share-case'),
  caseReadout: document.querySelector('#case-readout'),
  modifier: document.querySelector('#modifier-card'),
  questionsLeft: document.querySelector('#questions-left'),
  guessesLeft: document.querySelector('#guesses-left'),
  candidatesLeft: document.querySelector('#candidates-left'),
  questions: document.querySelector('#question-groups'),
  candidates: document.querySelector('#candidate-grid'),
  clues: document.querySelector('#clue-log'),
  announce: document.querySelector('#announce'),
  resultTitle: document.querySelector('#result-title'),
  resultCopy: document.querySelector('#result-copy'),
  secret: document.querySelector('#secret-name'),
  score: document.querySelector('#score'),
  same: document.querySelector('#play-same'),
  newCase: document.querySelector('#play-new')
};

let data = null;
let state = null;

function escapeHtml(value = '') {
  return String(value).replace(/[&<>"']/g, (character) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
  }[character]));
}

function randomCode() {
  const values = new Uint32Array(6);
  crypto.getRandomValues(values);
  return [...values].map((number) => CASE_ALPHABET[number % CASE_ALPHABET.length]).join('');
}

function strainById(id) {
  return data.strains.find((strain) => strain.id === id) || null;
}

function setCode(value) {
  ui.code.value = normalizeCaseCode(value);
  ui.code.setAttribute('aria-invalid', String(ui.code.value.length > 0 && !isValidCaseCode(ui.code.value)));
}

function challengeUrl() {
  const params = new URLSearchParams({ case: state?.code || normalizeCaseCode(ui.code.value) });
  if (state?.wild ?? ui.wild.checked) params.set('wild', '1');
  return `${location.origin}${location.pathname}?${params}`;
}

function renderStats() {
  ui.caseReadout.textContent = state.code;
  ui.questionsLeft.textContent = String(questionsLeft(state));
  ui.guessesLeft.textContent = String(state.guessesLeft);
  ui.candidatesLeft.textContent = String(state.candidates.length);
}

function renderModifier() {
  if (!state.modifier) {
    ui.modifier.hidden = true;
    return;
  }
  ui.modifier.hidden = false;
  ui.modifier.innerHTML = `<span>WILD CARD</span><strong>${escapeHtml(state.modifier.label)}</strong><p>${escapeHtml(state.modifier.description)}</p>`;
}

function renderQuestions() {
  ui.questions.replaceChildren();
  if (state.status !== 'playing') return;
  const available = questionsLeft(state) > 0 ? rankedQuestionOptions(state, data) : [];
  const groups = new Map();
  for (const question of available) {
    if (!groups.has(question.group)) groups.set(question.group, []);
    groups.get(question.group).push(question);
  }

  if (!available.length) {
    const empty = document.createElement('p');
    empty.className = 'empty-state';
    empty.textContent = questionsLeft(state) > 0
      ? 'No unused question can split the remaining candidates. Make a guess.'
      : 'No questions remain. Make a guess.';
    ui.questions.append(empty);
    return;
  }

  for (const [group, questions] of groups) {
    const section = document.createElement('section');
    section.className = 'question-group';
    const heading = document.createElement('h3');
    heading.textContent = group;
    section.append(heading);
    const grid = document.createElement('div');
    grid.className = 'question-grid';
    for (const question of questions) {
      const button = document.createElement('button');
      button.type = 'button';
      button.className = `question-card${question.bestSplit ? ' best-split' : ''}`;
      button.dataset.question = question.id;
      button.setAttribute('aria-label', `${question.prompt}. Splits ${question.yesCount} yes and ${question.noCount} no. Information ${question.informationScore} percent${question.bestSplit ? '. Best current split.' : '.'}`);
      button.innerHTML = `<strong>${escapeHtml(question.prompt)}</strong><small>Splits ${question.yesCount} yes / ${question.noCount} no · <span class="info-score">Information ${question.informationScore}%${question.bestSplit ? ' · BEST SPLIT' : ''}</span></small>`;
      grid.append(button);
    }
    section.append(grid);
    ui.questions.append(section);
  }
}

function renderCandidates() {
  ui.candidates.replaceChildren();
  for (const strain of data.strains) {
    const alive = state.candidates.includes(strain.id);
    const wrong = state.wrongGuesses.includes(strain.id);
    const button = document.createElement('button');
    button.type = 'button';
    button.className = `candidate-card${alive ? '' : ' eliminated'}${wrong ? ' wrong' : ''}`;
    button.dataset.guess = strain.id;
    button.disabled = state.status !== 'playing' || !alive;
    button.innerHTML = `<span class="candidate-mark" aria-hidden="true">${alive ? '?' : '×'}</span><strong>${escapeHtml(strain.name)}</strong><small>${wrong ? 'Wrong guess' : alive ? 'Still possible' : 'Eliminated'}</small>`;
    ui.candidates.append(button);
  }
}

function renderClues() {
  ui.clues.replaceChildren();
  if (!state.clues.length) {
    const empty = document.createElement('p');
    empty.className = 'empty-state';
    empty.textContent = 'Ask a question to start narrowing the roster.';
    ui.clues.append(empty);
    return;
  }
  for (const clue of [...state.clues].reverse()) {
    const row = document.createElement('article');
    row.className = `clue clue-${clue.answer}`;
    row.innerHTML = `<span>${clue.answer.toUpperCase()}</span><div><strong>${escapeHtml(clue.prompt)}</strong><small>${clue.remaining} candidate${clue.remaining === 1 ? '' : 's'} remain</small></div>`;
    ui.clues.append(row);
  }
}

function showResult() {
  const secret = strainById(state.secretId);
  ui.game.hidden = true;
  ui.result.hidden = false;
  ui.secret.textContent = secret?.name || 'Unknown profile';
  if (state.status === 'won') {
    const score = gameScore(state);
    ui.resultTitle.textContent = 'Mystery Solved';
    ui.resultCopy.textContent = `You identified the hidden profile using ${state.questionsAsked.length} question${state.questionsAsked.length === 1 ? '' : 's'} and ${state.initialGuesses - state.guessesLeft + 1} total guess${state.initialGuesses - state.guessesLeft + 1 === 1 ? '' : 'es'}.`;
    ui.score.textContent = `${score} deduction points · lower is better`;
  } else {
    ui.resultTitle.textContent = 'Case Closed — Mystery Escaped';
    ui.resultCopy.textContent = 'You used all available guesses. Replay the same case to test a different question path.';
    ui.score.textContent = 'No score recorded';
  }
  ui.result.scrollIntoView({ behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth', block: 'start' });
}

function renderGame() {
  renderStats();
  renderModifier();
  renderQuestions();
  renderCandidates();
  renderClues();
  if (state.status !== 'playing') showResult();
}

function enterGame(nextState) {
  state = nextState;
  ui.setup.hidden = true;
  ui.result.hidden = true;
  ui.game.hidden = false;
  history.replaceState(null, '', challengeUrl());
  renderGame();
  ui.announce.textContent = `Case ${state.code} started with ${state.candidates.length} candidates. Questions are ranked by information split.`;
  document.querySelector('#mystery-heading')?.focus({ preventScroll: true });
}

function startFromControls() {
  const code = normalizeCaseCode(ui.code.value);
  if (!isValidCaseCode(code)) {
    ui.code.setAttribute('aria-invalid', 'true');
    ui.announce.textContent = 'Enter a complete six-character case code.';
    ui.code.focus();
    return;
  }
  enterGame(createGame({ code, wild: ui.wild.checked }, data));
}

function resetSetup({ preserveCode = false } = {}) {
  state = null;
  ui.game.hidden = true;
  ui.result.hidden = true;
  ui.setup.hidden = false;
  if (!preserveCode) setCode(randomCode());
  history.replaceState(null, '', location.pathname);
  ui.code.focus({ preventScroll: true });
}

ui.code.addEventListener('input', () => setCode(ui.code.value));
ui.code.addEventListener('keydown', (event) => {
  if (event.key === 'Enter') startFromControls();
});
ui.random.addEventListener('click', () => setCode(randomCode()));
ui.start.addEventListener('click', startFromControls);
ui.share.addEventListener('click', async () => {
  const code = state?.code || normalizeCaseCode(ui.code.value);
  if (!isValidCaseCode(code)) {
    ui.announce.textContent = 'Create a complete case code before sharing.';
    return;
  }
  const url = challengeUrl();
  try {
    await navigator.clipboard.writeText(`Mystery Strain case ${code}${state?.wild ?? ui.wild.checked ? ' · Wild Card' : ''}\n${url}`);
    ui.announce.textContent = 'Challenge link copied.';
  } catch {
    ui.announce.textContent = `Share case ${code}: ${url}`;
  }
});
ui.questions.addEventListener('click', (event) => {
  const button = event.target.closest('button[data-question]');
  if (!button || !state) return;
  try {
    state = askQuestion(state, button.dataset.question, data);
    const clue = state.clues.at(-1);
    ui.announce.textContent = `${clue.prompt} ${clue.answer.toUpperCase()}. ${clue.remaining} candidates remain.`;
    renderGame();
  } catch (error) {
    ui.announce.textContent = error.message;
  }
});
ui.candidates.addEventListener('click', (event) => {
  const button = event.target.closest('button[data-guess]');
  if (!button || !state) return;
  const name = strainById(button.dataset.guess)?.name || 'that profile';
  try {
    const before = state.guessesLeft;
    state = guessStrain(state, button.dataset.guess, data);
    if (state.status === 'won') ui.announce.textContent = `Correct. ${name} solved the mystery.`;
    else if (state.status === 'lost') ui.announce.textContent = `Wrong. ${name} used the final guess.`;
    else ui.announce.textContent = `Wrong. ${name} eliminated. ${before - 1} guesses remain.`;
    renderGame();
  } catch (error) {
    ui.announce.textContent = error.message;
  }
});
ui.same.addEventListener('click', () => enterGame(createGame({ code: state.code, wild: state.wild }, data)));
ui.newCase.addEventListener('click', () => resetSetup());

async function load() {
  try {
    const response = await fetch('./data/strains.json', { cache: 'no-store', credentials: 'same-origin' });
    if (!response.ok) throw new Error(`data HTTP ${response.status}`);
    data = await response.json();
    if (data.schemaVersion !== 1 || data.strains?.length !== 20 || data.questions?.length !== 12) throw new Error('data contract mismatch');

    const params = new URLSearchParams(location.search);
    const requested = normalizeCaseCode(params.get('case'));
    setCode(isValidCaseCode(requested) ? requested : randomCode());
    ui.wild.checked = params.get('wild') === '1';
    ui.load.textContent = '20 fictional profiles · information-ranked questions · deterministic case codes';
    ui.setup.hidden = false;
    if (isValidCaseCode(requested)) startFromControls();
  } catch (error) {
    console.error(error);
    ui.load.textContent = 'Mystery Strain could not load its game data.';
  }
}

load();
