const state = {
  questions: [],
  sources: new Map(),
  session: [],
  index: 0,
  selectedLetter: null,
  locked: false,
  score: 0,
  possible: 0,
  answered: 0,
  correct: 0
};

const ui = {
  loading: document.querySelector('#loading-status'),
  setup: document.querySelector('#quiz-setup'),
  quiz: document.querySelector('#quiz-panel'),
  results: document.querySelector('#results-panel'),
  category: document.querySelector('#category-filter'),
  difficulty: document.querySelector('#difficulty-filter'),
  count: document.querySelector('#question-count'),
  start: document.querySelector('#start-quiz'),
  progressText: document.querySelector('#progress-text'),
  progressBar: document.querySelector('#quiz-progress'),
  categoryBadge: document.querySelector('#question-category'),
  difficultyBadge: document.querySelector('#question-difficulty'),
  pointsBadge: document.querySelector('#question-points'),
  question: document.querySelector('#question-text'),
  answers: document.querySelector('#answer-options'),
  lock: document.querySelector('#lock-answer'),
  feedback: document.querySelector('#answer-feedback'),
  feedbackTitle: document.querySelector('#feedback-title'),
  explanation: document.querySelector('#answer-explanation'),
  context: document.querySelector('#answer-context'),
  sources: document.querySelector('#answer-sources'),
  next: document.querySelector('#next-question'),
  live: document.querySelector('#quiz-live'),
  resultScore: document.querySelector('#result-score'),
  resultDetail: document.querySelector('#result-detail'),
  restart: document.querySelector('#restart-quiz')
};

function fail(message) {
  throw new Error(`High IQ: ${message}`);
}

async function fetchJson(relativePath) {
  const response = await fetch(relativePath, { credentials: 'same-origin' });
  if (!response.ok) fail(`could not load ${relativePath} (${response.status})`);
  return response.json();
}

function shuffle(items) {
  const copy = [...items];
  for (let index = copy.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(Math.random() * (index + 1));
    [copy[index], copy[swapIndex]] = [copy[swapIndex], copy[index]];
  }
  return copy;
}

function uniqueSorted(values) {
  return [...new Set(values)].sort((a, b) => a.localeCompare(b));
}

function makeOption(value, label) {
  const option = document.createElement('option');
  option.value = value;
  option.textContent = label;
  return option;
}

function populateFilters() {
  ui.category.replaceChildren(makeOption('all', 'All categories'));
  for (const category of uniqueSorted(state.questions.map((question) => question.category))) {
    ui.category.append(makeOption(category, category));
  }

  const preferredOrder = ['Easy', 'Medium', 'Hard', 'Expert'];
  ui.difficulty.replaceChildren(makeOption('all', 'All difficulties'));
  for (const difficulty of preferredOrder.filter((value) => state.questions.some((question) => question.difficulty === value))) {
    ui.difficulty.append(makeOption(difficulty, difficulty));
  }
}

function filterPool() {
  const category = ui.category.value;
  const difficulty = ui.difficulty.value;
  return state.questions.filter((question) => {
    if (category !== 'all' && question.category !== category) return false;
    if (difficulty !== 'all' && question.difficulty !== difficulty) return false;
    return true;
  });
}

function updateCountOptions() {
  const poolSize = filterPool().length;
  const requested = ui.count.value;
  const choices = [5, 10, 20, 40, poolSize]
    .filter((value, index, array) => value > 0 && value <= poolSize && array.indexOf(value) === index)
    .sort((a, b) => a - b);

  ui.count.replaceChildren();
  for (const count of choices) {
    ui.count.append(makeOption(String(count), count === poolSize ? `All matching (${count})` : `${count} questions`));
  }

  if (choices.map(String).includes(requested)) ui.count.value = requested;
  else if (choices.includes(10)) ui.count.value = '10';
  else ui.count.value = String(choices.at(-1) || 0);

  ui.start.disabled = poolSize === 0;
  ui.start.textContent = poolSize === 0 ? 'No matching questions' : 'Start challenge';
}

function resetSession() {
  state.session = [];
  state.index = 0;
  state.selectedLetter = null;
  state.locked = false;
  state.score = 0;
  state.possible = 0;
  state.answered = 0;
  state.correct = 0;
}

function startQuiz() {
  const pool = filterPool();
  const count = Number.parseInt(ui.count.value, 10);
  if (!pool.length || !Number.isInteger(count) || count < 1) return;

  resetSession();
  state.session = shuffle(pool).slice(0, Math.min(count, pool.length));
  state.possible = state.session.reduce((sum, question) => sum + question.points, 0);
  ui.setup.hidden = true;
  ui.results.hidden = true;
  ui.quiz.hidden = false;
  renderQuestion();
}

function currentQuestion() {
  return state.session[state.index] || null;
}

function announce(message) {
  ui.live.textContent = '';
  requestAnimationFrame(() => { ui.live.textContent = message; });
}

function selectAnswer(letter, button) {
  if (state.locked) return;
  state.selectedLetter = letter;
  for (const option of ui.answers.querySelectorAll('button')) option.setAttribute('aria-pressed', 'false');
  button.setAttribute('aria-pressed', 'true');
  ui.lock.disabled = false;
  announce(`Selected answer ${letter}. Lock your answer when ready.`);
}

function renderQuestion() {
  const question = currentQuestion();
  if (!question) return showResults();

  state.selectedLetter = null;
  state.locked = false;
  ui.feedback.hidden = true;
  ui.lock.hidden = false;
  ui.lock.disabled = true;
  ui.next.hidden = true;

  const number = state.index + 1;
  ui.progressText.textContent = `Question ${number} of ${state.session.length}`;
  ui.progressBar.max = state.session.length;
  ui.progressBar.value = state.index;
  ui.categoryBadge.textContent = question.category;
  ui.difficultyBadge.textContent = question.difficulty;
  ui.pointsBadge.textContent = `${question.points} ${question.points === 1 ? 'point' : 'points'}`;
  ui.question.textContent = question.question;
  ui.answers.replaceChildren();

  for (const letter of ['A', 'B', 'C', 'D']) {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'answer-option';
    button.dataset.letter = letter;
    button.setAttribute('aria-pressed', 'false');

    const marker = document.createElement('span');
    marker.className = 'answer-letter';
    marker.textContent = letter;

    const text = document.createElement('span');
    text.textContent = question.choices[letter];

    button.append(marker, text);
    button.addEventListener('click', () => selectAnswer(letter, button));
    ui.answers.append(button);
  }

  ui.question.focus({ preventScroll: true });
  announce(`Question ${number} of ${state.session.length}. ${question.difficulty}, ${question.points} points.`);
}

function renderSources(question) {
  ui.sources.replaceChildren();
  for (const sourceId of question.sourceIds) {
    const source = state.sources.get(sourceId);
    const item = document.createElement('li');
    if (!source) {
      item.textContent = sourceId;
      ui.sources.append(item);
      continue;
    }

    const link = document.createElement('a');
    link.href = source.url;
    link.target = '_blank';
    link.rel = 'noopener noreferrer';
    link.textContent = `${source.id}: ${source.title}`;
    item.append(link);
    ui.sources.append(item);
  }
}

function lockAnswer() {
  if (state.locked || !state.selectedLetter) return;
  const question = currentQuestion();
  state.locked = true;
  state.answered += 1;

  const isCorrect = state.selectedLetter === question.correctLetter;
  if (isCorrect) {
    state.correct += 1;
    state.score += question.points;
  }

  for (const button of ui.answers.querySelectorAll('button')) {
    button.disabled = true;
    const letter = button.dataset.letter;
    if (letter === question.correctLetter) button.classList.add('is-correct');
    else if (letter === state.selectedLetter) button.classList.add('is-incorrect');
  }

  ui.feedback.hidden = false;
  ui.feedback.classList.toggle('correct', isCorrect);
  ui.feedback.classList.toggle('incorrect', !isCorrect);
  ui.feedbackTitle.textContent = isCorrect
    ? `Correct — +${question.points} ${question.points === 1 ? 'point' : 'points'}`
    : `Not quite — the best answer is ${question.correctLetter}`;
  ui.explanation.textContent = question.explanation;
  ui.context.textContent = question.context;
  renderSources(question);

  ui.lock.hidden = true;
  ui.next.hidden = false;
  ui.next.textContent = state.index === state.session.length - 1 ? 'See results' : 'Next question';
  ui.progressBar.value = state.index + 1;
  ui.next.focus({ preventScroll: true });
  announce(isCorrect ? 'Correct answer.' : `Incorrect. The best answer is ${question.correctLetter}.`);
}

function nextQuestion() {
  if (!state.locked) return;
  state.index += 1;
  if (state.index >= state.session.length) showResults();
  else renderQuestion();
}

function showResults() {
  ui.quiz.hidden = true;
  ui.results.hidden = false;
  ui.progressBar.value = state.session.length;
  const percent = state.possible ? Math.round((state.score / state.possible) * 100) : 0;
  ui.resultScore.textContent = `${state.score} / ${state.possible} points (${percent}%)`;
  ui.resultDetail.textContent = `${state.correct} of ${state.answered} questions answered correctly. Difficulty-weighted points reward harder questions more heavily.`;
  ui.restart.focus({ preventScroll: true });
  announce(`Challenge complete. Score ${state.score} out of ${state.possible} points.`);
}

function returnToSetup() {
  resetSession();
  ui.quiz.hidden = true;
  ui.results.hidden = true;
  ui.setup.hidden = false;
  updateCountOptions();
  ui.start.focus({ preventScroll: true });
}

async function loadData() {
  try {
    const manifest = await fetchJson('./data/manifest.json');
    const questionGroups = await Promise.all(manifest.questionChunks.map((filename) => fetchJson(`./data/${filename}`)));
    const sourceGroups = await Promise.all(manifest.sourceChunks.map((filename) => fetchJson(`./data/${filename}`)));
    state.questions = questionGroups.flat();
    state.sources = new Map(sourceGroups.flat().map((source) => [source.id, source]));

    if (state.questions.length !== manifest.questionCount) fail(`expected ${manifest.questionCount} questions but loaded ${state.questions.length}`);
    if (state.sources.size !== manifest.sourceCount) fail(`expected ${manifest.sourceCount} sources but loaded ${state.sources.size}`);

    populateFilters();
    updateCountOptions();
    ui.loading.textContent = `${state.questions.length} verified questions loaded · dataset v${manifest.datasetVersion}`;
    ui.setup.hidden = false;
  } catch (error) {
    console.error(error);
    ui.loading.textContent = 'The self-hosted question bank could not be loaded.';
    const fallback = document.querySelector('#legacy-fallback');
    fallback.hidden = false;
  }
}

ui.category.addEventListener('change', updateCountOptions);
ui.difficulty.addEventListener('change', updateCountOptions);
ui.start.addEventListener('click', startQuiz);
ui.lock.addEventListener('click', lockAnswer);
ui.next.addEventListener('click', nextQuestion);
ui.restart.addEventListener('click', returnToSetup);

document.addEventListener('keydown', (event) => {
  if (ui.quiz.hidden || state.locked) return;
  const map = { '1': 'A', '2': 'B', '3': 'C', '4': 'D', a: 'A', b: 'B', c: 'C', d: 'D' };
  const letter = map[event.key.toLowerCase()];
  if (!letter) return;
  const button = ui.answers.querySelector(`[data-letter="${letter}"]`);
  if (button && !button.disabled) {
    event.preventDefault();
    button.click();
    button.focus();
  }
});

loadData();
