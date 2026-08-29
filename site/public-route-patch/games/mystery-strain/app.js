const CASE_CODE_LENGTH = 6;
const CASE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
const STANDARD_QUESTIONS = 8;
const STANDARD_GUESSES = 3;

const WILD_MODIFIERS = Object.freeze([
  {
    id: 'foggy-jar',
    label: 'Foggy Jar',
    description: 'Your first question returns UNKNOWN and does not narrow the candidate list.',
    maxQuestions: 8,
    guesses: 3
  },
  {
    id: 'extra-sniff',
    label: 'Extra Sniff',
    description: 'You get one additional yes/no question.',
    maxQuestions: 9,
    guesses: 3
  },
  {
    id: 'risky-read',
    label: 'Risky Read',
    description: 'You get one fewer question, but one extra guess.',
    maxQuestions: 7,
    guesses: 4
  }
]);

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function hash(value) {
  let result = 2166136261;
  for (const character of String(value)) {
    result ^= character.charCodeAt(0);
    result = Math.imul(result, 16777619);
  }
  return result >>> 0;
}

function normalizeCaseCode(value) {
  const allowed = new Set(CASE_ALPHABET);
  return String(value ?? '')
    .trim()
    .toUpperCase()
    .split('')
    .filter((character) => allowed.has(character))
    .join('')
    .slice(0, CASE_CODE_LENGTH);
}

function isValidCaseCode(value) {
  return normalizeCaseCode(value).length === CASE_CODE_LENGTH;
}

function strainMap(data) {
  return new Map(data.strains.map((strain) => [strain.id, strain]));
}

function questionMap(data) {
  return new Map(data.questions.map((question) => [question.id, question]));
}

function modifierFor(code, wild) {
  if (!wild) return null;
  return WILD_MODIFIERS[hash(`${code}:modifier`) % WILD_MODIFIERS.length];
}

function configFor(modifier) {
  return {
    maxQuestions: modifier?.maxQuestions ?? STANDARD_QUESTIONS,
    guesses: modifier?.guesses ?? STANDARD_GUESSES
  };
}

function createGame({ code, wild = false } = {}, data) {
  if (!data?.strains?.length || !data?.questions?.length) throw new Error('Mystery Strain data is required.');
  const normalized = normalizeCaseCode(code);
  if (!isValidCaseCode(normalized)) throw new Error('A six-character case code is required.');

  const secret = data.strains[hash(`${normalized}:secret`) % data.strains.length];
  const modifier = modifierFor(normalized, Boolean(wild));
  const config = configFor(modifier);
  const fogQuestionIndex = modifier?.id === 'foggy-jar' ? 0 : null;

  return {
    schemaVersion: 1,
    code: normalized,
    wild: Boolean(wild),
    modifier: modifier ? clone(modifier) : null,
    fogQuestionIndex,
    secretId: secret.id,
    candidates: data.strains.map((strain) => strain.id),
    questionsAsked: [],
    clues: [],
    maxQuestions: config.maxQuestions,
    guessesLeft: config.guesses,
    initialGuesses: config.guesses,
    wrongGuesses: [],
    status: 'playing'
  };
}

function questionOptions(state, data) {
  if (state.status !== 'playing') return [];
  const strains = strainMap(data);
  return data.questions
    .filter((question) => !state.questionsAsked.includes(question.id))
    .map((question) => {
      const yes = state.candidates.filter((id) => strains.get(id)?.traits.includes(question.id)).length;
      return {
        ...question,
        yesCount: yes,
        noCount: state.candidates.length - yes,
        informative: yes > 0 && yes < state.candidates.length
      };
    })
    .filter((question) => question.informative);
}

function askQuestion(inputState, questionId, data) {
  const state = clone(inputState);
  if (state.status !== 'playing') throw new Error('This mystery is already complete.');
  if (state.questionsAsked.length >= state.maxQuestions) throw new Error('No questions remain. Make a guess.');
  if (state.questionsAsked.includes(questionId)) throw new Error('That question was already used.');

  const questions = questionMap(data);
  const question = questions.get(questionId);
  if (!question) throw new Error(`Unknown question: ${questionId}`);
  if (!questionOptions(state, data).some((option) => option.id === questionId)) {
    throw new Error('That question no longer separates the remaining candidates.');
  }

  const strains = strainMap(data);
  const secret = strains.get(state.secretId);
  const questionIndex = state.questionsAsked.length;
  const fogged = state.modifier?.id === 'foggy-jar' && state.fogQuestionIndex === questionIndex;
  let answer = 'unknown';

  state.questionsAsked.push(questionId);
  if (!fogged) {
    const secretHasTrait = secret.traits.includes(questionId);
    answer = secretHasTrait ? 'yes' : 'no';
    state.candidates = state.candidates.filter((id) => {
      const hasTrait = strains.get(id)?.traits.includes(questionId);
      return secretHasTrait ? hasTrait : !hasTrait;
    });
  }

  state.clues.push({
    questionId,
    prompt: question.prompt,
    answer,
    remaining: state.candidates.length
  });

  return state;
}

function guessStrain(inputState, strainId, data) {
  const state = clone(inputState);
  if (state.status !== 'playing') throw new Error('This mystery is already complete.');
  if (!state.candidates.includes(strainId)) throw new Error('That cultivar has already been eliminated.');

  if (strainId === state.secretId) {
    state.status = 'won';
    return state;
  }

  state.guessesLeft -= 1;
  state.wrongGuesses.push(strainId);
  state.candidates = state.candidates.filter((id) => id !== strainId);
  if (state.guessesLeft <= 0) state.status = 'lost';
  return state;
}

function questionsLeft(state) {
  return Math.max(0, state.maxQuestions - state.questionsAsked.length);
}

function gameScore(state) {
  if (state.status !== 'won') return null;
  const guessesUsed = state.initialGuesses - state.guessesLeft;
  return state.questionsAsked.length + guessesUsed * 2;
}

function informationScore(option) {
  const yes = Number(option?.yesCount ?? 0);
  const no = Number(option?.noCount ?? 0);
  const total = yes + no;
  if (!Number.isFinite(total) || total <= 0 || yes < 0 || no < 0) return 0;
  return Math.round((2 * Math.min(yes, no) / total) * 100);
}

function rankedQuestionOptions(state, data) {
  const options = questionOptions(state, data).map((option) => ({
    ...option,
    informationScore: informationScore(option)
  }));

  options.sort((a, b) =>
    b.informationScore - a.informationScore ||
    Math.abs(a.yesCount - a.noCount) - Math.abs(b.yesCount - b.noCount) ||
    a.id.localeCompare(b.id)
  );

  return options.map((option, index) => ({
    ...option,
    bestSplit: index === 0 && option.informationScore > 0
  }));
}

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

function readEmbeddedData() {
  const node = document.querySelector('#mystery-strain-data');
  if (!node) throw new Error('Embedded deduction data is missing.');
  const parsed = JSON.parse(node.textContent || '{}');
  validateData(parsed);
  return parsed;
}

function validateData(candidate) {
  if (candidate?.schemaVersion !== 1) throw new Error('data contract mismatch');
  if (!Array.isArray(candidate.questions) || candidate.questions.length !== 12) throw new Error('expected 12 deduction questions');
  if (!Array.isArray(candidate.strains) || candidate.strains.length !== 20) throw new Error('expected 20 fictional profiles');

  const questionIds = new Set();
  for (const question of candidate.questions) {
    if (!question?.id || !question?.group || !question?.prompt) throw new Error('a deduction question is incomplete');
    if (questionIds.has(question.id)) throw new Error(`duplicate question id: ${question.id}`);
    questionIds.add(question.id);
  }

  const strainIds = new Set();
  for (const strain of candidate.strains) {
    if (!strain?.id || !strain?.name || !Array.isArray(strain.traits)) throw new Error('a fictional profile is incomplete');
    if (strainIds.has(strain.id)) throw new Error(`duplicate profile id: ${strain.id}`);
    strainIds.add(strain.id);
    if (new Set(strain.traits).size !== strain.traits.length) throw new Error(`${strain.name} contains duplicate traits`);
    for (const trait of strain.traits) {
      if (!questionIds.has(trait)) throw new Error(`${strain.name} references unknown trait ${trait}`);
    }
  }
}

function randomCode() {
  const values = new Uint32Array(CASE_CODE_LENGTH);
  if (globalThis.crypto?.getRandomValues) {
    globalThis.crypto.getRandomValues(values);
  } else {
    for (let index = 0; index < values.length; index += 1) {
      values[index] = Math.floor(Math.random() * 0xffffffff);
    }
  }
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

function safeReplaceUrl(url) {
  try { history.replaceState(null, '', url); } catch {}
}

function safeFocus(element) {
  if (!element?.focus) return;
  try { element.focus({ preventScroll: true }); }
  catch { element.focus(); }
}

function prefersReducedMotion() {
  try { return globalThis.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false; }
  catch { return false; }
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
    ui.modifier.replaceChildren();
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
    button.setAttribute('aria-label', `${strain.name}. ${wrong ? 'Wrong guess.' : alive ? 'Still possible. Activate to guess.' : 'Eliminated.'}`);
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
    const totalGuesses = state.initialGuesses - state.guessesLeft + 1;
    ui.resultTitle.textContent = 'Mystery Solved';
    ui.resultCopy.textContent = `You identified the hidden profile using ${state.questionsAsked.length} question${state.questionsAsked.length === 1 ? '' : 's'} and ${totalGuesses} total guess${totalGuesses === 1 ? '' : 'es'}.`;
    ui.score.textContent = `${score} deduction points · lower is better`;
  } else {
    ui.resultTitle.textContent = 'Case Closed — Mystery Escaped';
    ui.resultCopy.textContent = 'You used all available guesses. Replay the same case to test a different question path.';
    ui.score.textContent = 'No score recorded';
  }
  try {
    ui.result.scrollIntoView({ behavior: prefersReducedMotion() ? 'auto' : 'smooth', block: 'start' });
  } catch {
    ui.result.scrollIntoView?.();
  }
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
  safeReplaceUrl(challengeUrl());
  renderGame();
  ui.announce.textContent = `Case ${state.code} started with ${state.candidates.length} candidates. Questions are ranked by information split.`;
  safeFocus(document.querySelector('#mystery-heading'));
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
  safeReplaceUrl(location.pathname);
  safeFocus(ui.code);
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
    if (!navigator.clipboard?.writeText) throw new Error('Clipboard API unavailable.');
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
    ui.announce.textContent = error instanceof Error ? error.message : String(error);
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
    ui.announce.textContent = error instanceof Error ? error.message : String(error);
  }
});
ui.same.addEventListener('click', () => enterGame(createGame({ code: state.code, wild: state.wild }, data)));
ui.newCase.addEventListener('click', () => resetSetup());

function load() {
  try {
    data = readEmbeddedData();
    const params = new URLSearchParams(location.search);
    const requested = normalizeCaseCode(params.get('case'));
    setCode(isValidCaseCode(requested) ? requested : randomCode());
    ui.wild.checked = params.get('wild') === '1';
    ui.load.textContent = '20 fictional profiles · information-ranked questions · deterministic case codes';
    ui.setup.hidden = false;
    if (isValidCaseCode(requested)) startFromControls();
  } catch (error) {
    console.error(error);
    ui.load.textContent = `Mystery Strain could not load its game data. ${error instanceof Error ? error.message : String(error)}`;
  }
}

load();
