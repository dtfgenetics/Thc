const state = {
  manifest: null,
  dataBase: null,
  questions: [],
  sources: new Map(),
  session: [],
  index: 0,
  selectedLetter: null,
  locked: false,
  score: 0,
  possible: 0,
  answered: 0,
  correct: 0,
  streak: 0,
  bestStreak: 0,
  categoryStats: new Map()
};

const ui = {
  loading: document.querySelector('#loading-status'),
  dataHealthDot: document.querySelector('#data-health-dot'),
  setup: document.querySelector('#quiz-setup'),
  quiz: document.querySelector('#quiz-panel'),
  results: document.querySelector('#results-panel'),
  category: document.querySelector('#category-filter'),
  difficulty: document.querySelector('#difficulty-filter'),
  count: document.querySelector('#question-count'),
  start: document.querySelector('#start-quiz'),
  poolSummary: document.querySelector('#pool-summary'),
  presetButtons: [...document.querySelectorAll('[data-preset-count]')],
  progressText: document.querySelector('#progress-text'),
  progressBar: document.querySelector('#quiz-progress'),
  liveScore: document.querySelector('#live-score'),
  liveStreak: document.querySelector('#live-streak'),
  categoryBadge: document.querySelector('#question-category'),
  difficultyBadge: document.querySelector('#question-difficulty'),
  pointsBadge: document.querySelector('#question-points'),
  question: document.querySelector('#question-text'),
  answers: document.querySelector('#answer-options'),
  lock: document.querySelector('#lock-answer'),
  feedback: document.querySelector('#answer-feedback'),
  feedbackTitle: document.querySelector('#feedback-title'),
  feedbackPoints: document.querySelector('#feedback-points'),
  explanation: document.querySelector('#answer-explanation'),
  context: document.querySelector('#answer-context'),
  sources: document.querySelector('#answer-sources'),
  next: document.querySelector('#next-question'),
  live: document.querySelector('#quiz-live'),
  resultScore: document.querySelector('#result-score'),
  resultDetail: document.querySelector('#result-detail'),
  resultRank: document.querySelector('#result-rank'),
  categoryResults: document.querySelector('#category-results'),
  studyRecommendation: document.querySelector('#study-recommendation'),
  restart: document.querySelector('#restart-quiz'),
  fallback: document.querySelector('#legacy-fallback'),
  retry: document.querySelector('#retry-data'),
  topicMap: document.querySelector('#topic-map'),
  heroQuestionCount: document.querySelector('#hero-question-count'),
  heroCategoryCount: document.querySelector('#hero-category-count'),
  heroSourceCount: document.querySelector('#hero-source-count'),
  heroVersion: document.querySelector('#hero-version')
};

function fail(message) {
  throw new Error(`High IQ: ${message}`);
}

function candidateDataBases() {
  const bases = ['/games/high-iq/data'];
  try {
    const relative = new URL('./data/', window.location.href).pathname.replace(/\/$/, '');
    if (relative && !bases.includes(relative)) bases.push(relative);
  } catch {}
  return bases;
}

async function fetchJsonUrl(url) {
  const response = await fetch(url, {
    credentials: 'same-origin',
    cache: 'no-store',
    headers: { Accept: 'application/json' }
  });
  const body = await response.text();
  if (!response.ok) fail(`could not load ${url} (${response.status})`);
  const trimmed = body.trim();
  if (!trimmed.startsWith('{') && !trimmed.startsWith('[')) {
    fail(`${url} returned non-JSON content`);
  }
  try {
    return JSON.parse(body);
  } catch {
    fail(`${url} returned invalid JSON`);
  }
}

async function loadFromBase(base) {
  const manifest = await fetchJsonUrl(`${base}/manifest.json?hiq=${Date.now()}`);
  if (!Array.isArray(manifest.questionChunks) || !Array.isArray(manifest.sourceChunks)) {
    fail(`manifest at ${base} is missing chunk lists`);
  }
  const version = encodeURIComponent(manifest.datasetVersion || 'current');
  const questionGroups = await Promise.all(
    manifest.questionChunks.map((filename) => fetchJsonUrl(`${base}/${filename}?v=${version}`))
  );
  const sourceGroups = await Promise.all(
    manifest.sourceChunks.map((filename) => fetchJsonUrl(`${base}/${filename}?v=${version}`))
  );
  const questions = questionGroups.flat();
  const sources = sourceGroups.flat();

  if (questions.length !== manifest.questionCount) {
    fail(`expected ${manifest.questionCount} questions but loaded ${questions.length}`);
  }
  if (sources.length !== manifest.sourceCount) {
    fail(`expected ${manifest.sourceCount} sources but loaded ${sources.length}`);
  }
  if (new Set(questions.map((question) => question.id)).size !== questions.length) {
    fail('duplicate question IDs detected in public data');
  }
  if (new Set(sources.map((source) => source.id)).size !== sources.length) {
    fail('duplicate source IDs detected in public data');
  }

  return { manifest, questions, sources };
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
  ui.category.replaceChildren(makeOption('all', 'All topics'));
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

function syncPresetButtons() {
  const selected = Number.parseInt(ui.count.value, 10);
  const poolSize = filterPool().length;
  for (const button of ui.presetButtons) {
    const count = Number.parseInt(button.dataset.presetCount || '0', 10);
    button.disabled = count > poolSize;
    button.classList.toggle('is-active', count === selected && !button.disabled);
  }
}

function updateCountOptions(preferredCount = null) {
  const pool = filterPool();
  const poolSize = pool.length;
  const requested = preferredCount === null ? ui.count.value : String(preferredCount);
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
  ui.poolSummary.textContent = poolSize === 0
    ? 'No questions match this filter.'
    : `${poolSize} verified ${poolSize === 1 ? 'question' : 'questions'} match this setup.`;
  syncPresetButtons();
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
  state.streak = 0;
  state.bestStreak = 0;
  state.categoryStats = new Map();
  ui.liveScore.textContent = '0 pts';
  ui.liveStreak.textContent = '0';
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
  ui.feedback.classList.remove('correct', 'incorrect');
  ui.lock.hidden = false;
  ui.lock.disabled = true;
  ui.next.hidden = true;

  const number = state.index + 1;
  ui.progressText.textContent = `${number} / ${state.session.length}`;
  ui.progressBar.max = state.session.length;
  ui.progressBar.value = state.index;
  ui.liveScore.textContent = `${state.score} / ${state.possible} pts`;
  ui.liveStreak.textContent = String(state.streak);
  ui.categoryBadge.textContent = question.category;
  ui.difficultyBadge.textContent = question.difficulty;
  ui.difficultyBadge.dataset.difficulty = question.difficulty.toLowerCase();
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
    text.className = 'answer-copy';
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
    link.textContent = source.title || source.id;

    const id = document.createElement('span');
    id.className = 'source-id';
    id.textContent = source.id;
    item.append(link, id);
    ui.sources.append(item);
  }
}

function updateCategoryStats(question, isCorrect) {
  const current = state.categoryStats.get(question.category) || {
    category: question.category,
    answered: 0,
    correct: 0,
    earned: 0,
    possible: 0
  };
  current.answered += 1;
  current.possible += question.points;
  if (isCorrect) {
    current.correct += 1;
    current.earned += question.points;
  }
  state.categoryStats.set(question.category, current);
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
    state.streak += 1;
    state.bestStreak = Math.max(state.bestStreak, state.streak);
  } else {
    state.streak = 0;
  }
  updateCategoryStats(question, isCorrect);

  for (const button of ui.answers.querySelectorAll('button')) {
    button.disabled = true;
    const letter = button.dataset.letter;
    if (letter === question.correctLetter) button.classList.add('is-correct');
    else if (letter === state.selectedLetter) button.classList.add('is-incorrect');
  }

  ui.liveScore.textContent = `${state.score} / ${state.possible} pts`;
  ui.liveStreak.textContent = String(state.streak);
  ui.feedback.hidden = false;
  ui.feedback.classList.toggle('correct', isCorrect);
  ui.feedback.classList.toggle('incorrect', !isCorrect);
  ui.feedbackTitle.textContent = isCorrect
    ? `Correct — ${question.correctAnswer}`
    : `Best answer: ${question.correctLetter} — ${question.correctAnswer}`;
  ui.feedbackPoints.textContent = isCorrect
    ? `+${question.points} ${question.points === 1 ? 'pt' : 'pts'}${state.streak > 1 ? ` · ${state.streak} streak` : ''}`
    : '0 pts';
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

function rankForPercent(percent) {
  if (percent >= 92) return 'Master Grower';
  if (percent >= 82) return 'Advanced Cultivator';
  if (percent >= 70) return 'Cultivator';
  if (percent >= 58) return 'Developing';
  return 'Study Run';
}

function renderCategoryResults() {
  ui.categoryResults.replaceChildren();
  const stats = [...state.categoryStats.values()].sort((a, b) => {
    const aPct = a.possible ? a.earned / a.possible : 0;
    const bPct = b.possible ? b.earned / b.possible : 0;
    return aPct - bPct || a.category.localeCompare(b.category);
  });

  for (const stat of stats) {
    const percent = stat.possible ? Math.round((stat.earned / stat.possible) * 100) : 0;
    const row = document.createElement('div');
    row.className = 'category-result-row';

    const heading = document.createElement('div');
    heading.className = 'category-result-heading';
    const name = document.createElement('strong');
    name.textContent = stat.category;
    const score = document.createElement('span');
    score.textContent = `${stat.correct}/${stat.answered} · ${percent}%`;
    heading.append(name, score);

    const meter = document.createElement('div');
    meter.className = 'mastery-meter';
    meter.setAttribute('role', 'progressbar');
    meter.setAttribute('aria-valuemin', '0');
    meter.setAttribute('aria-valuemax', '100');
    meter.setAttribute('aria-valuenow', String(percent));
    const fill = document.createElement('span');
    fill.style.width = `${percent}%`;
    meter.append(fill);

    row.append(heading, meter);
    ui.categoryResults.append(row);
  }
}

function renderStudyRecommendation() {
  const stats = [...state.categoryStats.values()];
  if (!stats.length) {
    ui.studyRecommendation.textContent = 'Run another mixed challenge to build a larger mastery sample.';
    return;
  }
  const weakest = stats.reduce((lowest, stat) => {
    const currentPct = stat.possible ? stat.earned / stat.possible : 0;
    const lowestPct = lowest.possible ? lowest.earned / lowest.possible : 0;
    return currentPct < lowestPct ? stat : lowest;
  });
  const percent = weakest.possible ? Math.round((weakest.earned / weakest.possible) * 100) : 0;
  if (percent === 100) {
    ui.studyRecommendation.textContent = `You cleared every tested topic in this run. Increase difficulty or broaden the category filter for a harder sample.`;
  } else {
    ui.studyRecommendation.textContent = `${weakest.category} was the lowest-scoring topic in this run at ${percent}%. Review that system, then rerun a filtered challenge to see whether the score moves.`;
  }
}

function updateBestScore(percent) {
  const storageKey = `high-iq-best-percent-v${state.manifest?.datasetVersion || 'current'}`;
  try {
    const previous = Number.parseInt(localStorage.getItem(storageKey) || '0', 10);
    if (percent > previous) localStorage.setItem(storageKey, String(percent));
    return Math.max(previous, percent);
  } catch {
    return percent;
  }
}

function showResults() {
  ui.quiz.hidden = true;
  ui.results.hidden = false;
  ui.progressBar.value = state.session.length;
  const percent = state.possible ? Math.round((state.score / state.possible) * 100) : 0;
  const bestPercent = updateBestScore(percent);
  ui.resultScore.textContent = `${state.score} / ${state.possible} points (${percent}%)`;
  ui.resultRank.textContent = rankForPercent(percent);
  ui.resultDetail.textContent = `${state.correct} of ${state.answered} correct · best streak ${state.bestStreak} · personal best ${bestPercent}% on dataset v${state.manifest?.datasetVersion || 'current'}.`;
  renderCategoryResults();
  renderStudyRecommendation();
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

function renderTopicMap(manifest) {
  ui.topicMap.replaceChildren();
  const entries = Object.entries(manifest.categoryCounts || {}).sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]));
  const max = Math.max(...entries.map(([, count]) => count), 1);
  for (const [category, count] of entries) {
    const item = document.createElement('article');
    item.className = 'topic-item';
    const top = document.createElement('div');
    const name = document.createElement('h3');
    name.textContent = category;
    const value = document.createElement('strong');
    value.textContent = String(count);
    top.append(name, value);
    const meter = document.createElement('div');
    meter.className = 'topic-meter';
    const fill = document.createElement('span');
    fill.style.width = `${Math.max(12, Math.round((count / max) * 100))}%`;
    meter.append(fill);
    const note = document.createElement('p');
    note.textContent = `${count} approved ${count === 1 ? 'question' : 'questions'} in the current bank`;
    item.append(top, meter, note);
    ui.topicMap.append(item);
  }
}

function applyManifest(manifest) {
  const categoryCount = Object.keys(manifest.categoryCounts || {}).length || uniqueSorted(state.questions.map((question) => question.category)).length;
  ui.heroQuestionCount.textContent = String(manifest.questionCount || state.questions.length);
  ui.heroCategoryCount.textContent = String(categoryCount);
  ui.heroSourceCount.textContent = String(manifest.sourceCount || state.sources.size);
  ui.heroVersion.textContent = String(manifest.datasetVersion || '—');
  renderTopicMap(manifest);
}

async function loadData() {
  ui.setup.hidden = true;
  ui.fallback.hidden = true;
  ui.loading.textContent = 'Loading verified question data…';
  ui.dataHealthDot.className = 'data-health-dot loading';
  const errors = [];

  for (const base of candidateDataBases()) {
    try {
      const loaded = await loadFromBase(base);
      state.manifest = loaded.manifest;
      state.dataBase = base;
      state.questions = loaded.questions;
      state.sources = new Map(loaded.sources.map((source) => [source.id, source]));
      populateFilters();
      updateCountOptions(10);
      applyManifest(loaded.manifest);
      ui.loading.textContent = `${state.questions.length} verified questions ready · dataset v${loaded.manifest.datasetVersion}`;
      ui.dataHealthDot.className = 'data-health-dot ready';
      ui.setup.hidden = false;
      return;
    } catch (error) {
      console.error(error);
      errors.push(error instanceof Error ? error.message : String(error));
    }
  }

  ui.loading.textContent = 'Production question bank unavailable';
  ui.dataHealthDot.className = 'data-health-dot error';
  ui.fallback.hidden = false;
  ui.fallback.dataset.error = errors.join(' | ').slice(0, 1000);
}

ui.category.addEventListener('change', () => updateCountOptions());
ui.difficulty.addEventListener('change', () => updateCountOptions());
ui.count.addEventListener('change', syncPresetButtons);
ui.start.addEventListener('click', startQuiz);
ui.lock.addEventListener('click', lockAnswer);
ui.next.addEventListener('click', nextQuestion);
ui.restart.addEventListener('click', returnToSetup);
ui.retry.addEventListener('click', loadData);
for (const button of ui.presetButtons) {
  button.addEventListener('click', () => {
    const count = Number.parseInt(button.dataset.presetCount || '0', 10);
    if (!button.disabled) updateCountOptions(count);
  });
}

document.addEventListener('keydown', (event) => {
  if (!ui.quiz.hidden) {
    if (event.key === 'Enter') {
      if (!state.locked && state.selectedLetter) {
        event.preventDefault();
        lockAnswer();
      } else if (state.locked) {
        event.preventDefault();
        nextQuestion();
      }
      return;
    }
    if (state.locked) return;
    const map = { '1': 'A', '2': 'B', '3': 'C', '4': 'D', a: 'A', b: 'B', c: 'C', d: 'D' };
    const letter = map[event.key.toLowerCase()];
    if (!letter) return;
    const button = ui.answers.querySelector(`[data-letter="${letter}"]`);
    if (button && !button.disabled) {
      event.preventDefault();
      button.click();
      button.focus();
    }
    return;
  }

  if (!ui.setup.hidden && event.key === 'Enter' && !ui.start.disabled && document.activeElement?.tagName !== 'SELECT') {
    event.preventDefault();
    startQuiz();
  }
});

loadData();
