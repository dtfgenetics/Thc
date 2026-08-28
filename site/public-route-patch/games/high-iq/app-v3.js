import { balancedSample, seededShuffle, rankForPercent } from './game-core.mjs';

const STORAGE_PREFIX = 'dtf-high-iq-v3';
const LETTERS = ['A', 'B', 'C', 'D'];
const DIFFICULTIES = ['Easy', 'Medium', 'Hard', 'Expert'];
const POINTS = { Easy: 1, Medium: 2, Hard: 3, Expert: 4 };

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
  categoryStats: new Map(),
  answers: [],
  runMode: 'balanced',
  dailyKey: null,
  loadErrors: []
};

const $ = (selector) => document.querySelector(selector);
const ui = {
  loading: $('#loading-status'),
  dataHealthDot: $('#data-health-dot'),
  dataErrorDetail: $('#data-error-detail'),
  setup: $('#quiz-setup'),
  quiz: $('#quiz-panel'),
  results: $('#results-panel'),
  category: $('#category-filter'),
  difficulty: $('#difficulty-filter'),
  mode: $('#question-mode'),
  count: $('#question-count'),
  start: $('#start-quiz'),
  daily: $('#daily-start'),
  dailyHero: $('#daily-hero-start'),
  poolSummary: $('#pool-summary'),
  presetButtons: [...document.querySelectorAll('[data-preset-count]')],
  progressText: $('#progress-text'),
  progressBar: $('#quiz-progress'),
  liveScore: $('#live-score'),
  liveStreak: $('#live-streak'),
  liveAccuracy: $('#live-accuracy'),
  categoryBadge: $('#question-category'),
  difficultyBadge: $('#question-difficulty'),
  pointsBadge: $('#question-points'),
  questionId: $('#question-id'),
  question: $('#question-text'),
  answers: $('#answer-options'),
  lock: $('#lock-answer'),
  feedback: $('#answer-feedback'),
  feedbackTitle: $('#feedback-title'),
  feedbackPoints: $('#feedback-points'),
  explanation: $('#answer-explanation'),
  context: $('#answer-context'),
  sources: $('#answer-sources'),
  next: $('#next-question'),
  live: $('#quiz-live'),
  resultScore: $('#result-score'),
  resultDetail: $('#result-detail'),
  resultRank: $('#result-rank'),
  resultAccuracy: $('#result-accuracy'),
  resultStreak: $('#result-streak'),
  resultBest: $('#result-best'),
  categoryResults: $('#category-results'),
  studyRecommendation: $('#study-recommendation'),
  missedReview: $('#missed-review'),
  practiceMissed: $('#practice-missed'),
  shareScore: $('#share-score'),
  restart: $('#restart-quiz'),
  historyList: $('#history-list'),
  clearHistory: $('#clear-history'),
  fallback: $('#legacy-fallback'),
  retry: $('#retry-data'),
  topicMap: $('#topic-map'),
  difficultyMap: $('#difficulty-map'),
  sourceMap: $('#source-map'),
  heroQuestionCount: $('#hero-question-count'),
  heroCategoryCount: $('#hero-category-count'),
  heroSourceCount: $('#hero-source-count'),
  heroVersion: $('#hero-version')
};

function assertUi() {
  const missing = Object.entries(ui).filter(([, value]) => value == null).map(([key]) => key);
  if (missing.length) throw new Error(`High IQ UI contract missing: ${missing.join(', ')}`);
}

function fail(message) {
  throw new Error(`High IQ: ${message}`);
}

function announce(message) {
  ui.live.textContent = '';
  requestAnimationFrame(() => { ui.live.textContent = message; });
}

function candidateDataBases() {
  const bases = ['/games/high-iq/data'];
  try {
    const relative = new URL('./data/', window.location.href).pathname.replace(/\/$/, '');
    if (relative && !bases.includes(relative)) bases.push(relative);
  } catch {}
  return bases;
}

async function fetchJsonUrl(url, timeoutMs = 12000) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(url, {
      credentials: 'same-origin',
      cache: 'no-store',
      signal: controller.signal,
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
  } catch (error) {
    if (error?.name === 'AbortError') fail(`${url} timed out`);
    throw error;
  } finally {
    clearTimeout(timer);
  }
}

async function loadFromBase(base) {
  const manifest = await fetchJsonUrl(`${base}/manifest.json?hiq=${Date.now()}`);
  if (!Array.isArray(manifest.questionChunks) || !Array.isArray(manifest.sourceChunks)) {
    fail(`manifest at ${base} is missing chunk lists`);
  }
  const version = encodeURIComponent(manifest.datasetVersion || 'current');
  const [questionGroups, sourceGroups] = await Promise.all([
    Promise.all(manifest.questionChunks.map((filename) => fetchJsonUrl(`${base}/${filename}?v=${version}`))),
    Promise.all(manifest.sourceChunks.map((filename) => fetchJsonUrl(`${base}/${filename}?v=${version}`)))
  ]);
  const questions = questionGroups.flat();
  const sources = sourceGroups.flat();

  if (questions.length !== manifest.questionCount) fail(`expected ${manifest.questionCount} questions but loaded ${questions.length}`);
  if (sources.length !== manifest.sourceCount) fail(`expected ${manifest.sourceCount} sources but loaded ${sources.length}`);
  if (new Set(questions.map((q) => q.id)).size !== questions.length) fail('duplicate question IDs detected');
  if (new Set(sources.map((source) => source.id)).size !== sources.length) fail('duplicate source IDs detected');

  const sourceIds = new Set(sources.map((source) => source.id));
  for (const question of questions) {
    if (!LETTERS.includes(question.correctLetter)) fail(`${question.id} has invalid correct letter`);
    if (question.choices?.[question.correctLetter] !== question.correctAnswer) fail(`${question.id} answer mapping is invalid`);
    if (!Array.isArray(question.sourceIds) || question.sourceIds.some((id) => !sourceIds.has(id))) fail(`${question.id} has unresolved sources`);
    if (question.status !== manifest.requiredStatus || question.audit !== manifest.requiredAudit) fail(`${question.id} is not production approved`);
  }
  return { manifest, questions, sources };
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
  const poolSize = filterPool().length;
  const requested = preferredCount == null ? ui.count.value : String(preferredCount);
  const choices = [5, 10, 20, 40, poolSize]
    .filter((value, index, values) => value > 0 && value <= poolSize && values.indexOf(value) === index)
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
    : `${poolSize} approved ${poolSize === 1 ? 'question' : 'questions'} match this setup.`;
  syncPresetButtons();
}

function populateFilters() {
  ui.category.replaceChildren(makeOption('all', 'All topics'));
  for (const category of uniqueSorted(state.questions.map((question) => question.category))) {
    ui.category.append(makeOption(category, category));
  }
  ui.difficulty.replaceChildren(makeOption('all', 'All difficulties'));
  for (const difficulty of DIFFICULTIES.filter((item) => state.questions.some((question) => question.difficulty === item))) {
    ui.difficulty.append(makeOption(difficulty, difficulty));
  }
  ui.mode.replaceChildren(makeOption('balanced', 'Balanced Mix'), makeOption('random', 'Random Mix'));
  updateCountOptions(10);
}

function resetSession() {
  Object.assign(state, {
    session: [], index: 0, selectedLetter: null, locked: false, score: 0, possible: 0,
    answered: 0, correct: 0, streak: 0, bestStreak: 0, categoryStats: new Map(), answers: [], dailyKey: null
  });
  ui.liveScore.textContent = '0 pts';
  ui.liveStreak.textContent = '0';
  ui.liveAccuracy.textContent = '—';
}

function startSession(questions, { mode = 'balanced', dailyKey = null } = {}) {
  if (!questions.length) return;
  resetSession();
  state.runMode = mode;
  state.dailyKey = dailyKey;
  state.session = questions;
  state.possible = questions.reduce((sum, question) => sum + Number(question.points || POINTS[question.difficulty] || 1), 0);
  ui.setup.hidden = true;
  ui.results.hidden = true;
  ui.quiz.hidden = false;
  renderQuestion();
  ui.quiz.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

function buildSession(pool, count, mode) {
  if (mode === 'balanced') return balancedSample(pool, Math.min(count, pool.length));
  return seededShuffle(pool, `${Date.now()}-${Math.random()}`).slice(0, Math.min(count, pool.length));
}

function startQuiz() {
  const pool = filterPool();
  const count = Number.parseInt(ui.count.value, 10);
  if (!pool.length || !Number.isInteger(count) || count < 1) return;
  startSession(buildSession(pool, count, ui.mode.value), { mode: ui.mode.value });
}

function dateKey(date = new Date()) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function startDaily() {
  if (!state.questions.length) return;
  const dailyKey = `${dateKey()}|${state.manifest?.datasetVersion || 'current'}`;
  const session = balancedSample(state.questions, Math.min(10, state.questions.length), dailyKey);
  startSession(session, { mode: 'daily', dailyKey });
}

function currentQuestion() {
  return state.session[state.index] || null;
}

function updateLiveStats() {
  ui.liveScore.textContent = `${state.score} / ${state.possible} pts`;
  ui.liveStreak.textContent = String(state.streak);
  ui.liveAccuracy.textContent = state.answered ? `${Math.round((state.correct / state.answered) * 100)}%` : '—';
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
  updateLiveStats();
  ui.categoryBadge.textContent = question.category;
  ui.difficultyBadge.textContent = question.difficulty;
  ui.difficultyBadge.dataset.difficulty = question.difficulty.toLowerCase();
  ui.pointsBadge.textContent = `${question.points} ${question.points === 1 ? 'point' : 'points'}`;
  ui.questionId.textContent = question.id;
  ui.question.textContent = question.question;
  ui.answers.replaceChildren();

  for (const letter of LETTERS) {
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

function renderSourceList(target, sourceIds) {
  target.replaceChildren();
  for (const sourceId of sourceIds) {
    const source = state.sources.get(sourceId);
    const item = document.createElement('li');
    if (!source) {
      item.textContent = sourceId;
      target.append(item);
      continue;
    }
    const copy = document.createElement('div');
    copy.className = 'source-copy';
    const link = document.createElement('a');
    link.href = source.url;
    link.target = '_blank';
    link.rel = 'noopener noreferrer';
    link.textContent = source.title || source.id;
    const meta = document.createElement('span');
    meta.className = 'source-meta';
    meta.textContent = source.organizationType || 'Reference';
    const use = document.createElement('span');
    use.className = 'source-use';
    use.textContent = source.verificationUse || '';
    copy.append(link, meta, use);
    const id = document.createElement('span');
    id.className = 'source-id';
    id.textContent = source.id;
    item.append(copy, id);
    target.append(item);
  }
}

function updateCategoryStats(question, isCorrect) {
  const current = state.categoryStats.get(question.category) || {
    category: question.category, answered: 0, correct: 0, earned: 0, possible: 0
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
  state.answers.push({
    questionId: question.id,
    category: question.category,
    selectedLetter: state.selectedLetter,
    correctLetter: question.correctLetter,
    correct: isCorrect
  });

  for (const button of ui.answers.querySelectorAll('button')) {
    button.disabled = true;
    const letter = button.dataset.letter;
    if (letter === question.correctLetter) button.classList.add('is-correct');
    else if (letter === state.selectedLetter) button.classList.add('is-incorrect');
  }

  updateLiveStats();
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
  renderSourceList(ui.sources, question.sourceIds);

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

function storageKey(name) {
  return `${STORAGE_PREFIX}:${state.manifest?.datasetVersion || 'current'}:${name}`;
}

function readJsonStorage(key, fallback) {
  try {
    const value = localStorage.getItem(key);
    return value ? JSON.parse(value) : fallback;
  } catch {
    return fallback;
  }
}

function saveHistory(run) {
  try {
    const key = storageKey('history');
    const history = readJsonStorage(key, []);
    history.unshift(run);
    localStorage.setItem(key, JSON.stringify(history.slice(0, 8)));
  } catch {}
}

function updateBestScore(percent) {
  const key = storageKey('best-percent');
  try {
    const previous = Number.parseInt(localStorage.getItem(key) || '0', 10);
    if (percent > previous) localStorage.setItem(key, String(percent));
    return Math.max(previous, percent);
  } catch {
    return percent;
  }
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
    const detail = document.createElement('span');
    detail.textContent = `${stat.correct}/${stat.answered} correct · ${percent}% weighted`;
    heading.append(name, detail);
    const meter = document.createElement('div');
    meter.className = 'mastery-meter';
    meter.setAttribute('role', 'progressbar');
    meter.setAttribute('aria-label', `${stat.category} mastery`);
    meter.setAttribute('aria-valuenow', String(percent));
    meter.setAttribute('aria-valuemin', '0');
    meter.setAttribute('aria-valuemax', '100');
    const fill = document.createElement('span');
    fill.style.width = `${percent}%`;
    meter.append(fill);
    row.append(heading, meter);
    ui.categoryResults.append(row);
  }
}

function weakestCategory() {
  return [...state.categoryStats.values()]
    .map((stat) => ({ ...stat, percent: stat.possible ? Math.round((stat.earned / stat.possible) * 100) : 0 }))
    .sort((a, b) => a.percent - b.percent || a.category.localeCompare(b.category))[0] || null;
}

function renderStudyRecommendation() {
  const weakest = weakestCategory();
  if (!weakest) {
    ui.studyRecommendation.textContent = 'Run a challenge to generate a study recommendation.';
    return;
  }
  if (weakest.percent >= 90) {
    ui.studyRecommendation.textContent = 'Strong run across the tested topics. Increase difficulty or run a longer mixed session to expose narrower gaps.';
  } else if (weakest.percent >= 70) {
    ui.studyRecommendation.textContent = `${weakest.category} was the lowest-scoring topic at ${weakest.percent}%. A focused rerun in that topic is the fastest way to test retention.`;
  } else {
    ui.studyRecommendation.textContent = `${weakest.category} needs the most attention from this run (${weakest.percent}%). Review the explanations and sources below, study that system, then rerun a filtered challenge.`;
  }
}

function renderMissedReview() {
  ui.missedReview.replaceChildren();
  const misses = state.answers.filter((answer) => !answer.correct);
  ui.practiceMissed.hidden = misses.length === 0;

  if (!misses.length) {
    const wrapper = document.createElement('div');
    wrapper.className = 'perfect-run';
    const mark = document.createElement('span');
    mark.className = 'perfect-run-mark';
    mark.textContent = '✓';
    const copy = document.createElement('div');
    const strong = document.createElement('strong');
    strong.textContent = 'No missed questions in this run.';
    const text = document.createElement('p');
    text.textContent = 'Raise the difficulty or length to keep testing the edges of your knowledge.';
    copy.append(strong, text);
    wrapper.append(mark, copy);
    ui.missedReview.append(wrapper);
    return;
  }

  for (const answer of misses) {
    const question = state.questions.find((item) => item.id === answer.questionId);
    if (!question) continue;
    const card = document.createElement('article');
    card.className = 'missed-card';
    const meta = document.createElement('div');
    meta.className = 'missed-meta';
    for (const value of [question.id, question.category, question.difficulty]) {
      const span = document.createElement('span');
      span.textContent = value;
      meta.append(span);
    }
    const heading = document.createElement('h4');
    heading.textContent = question.question;
    const comparison = document.createElement('div');
    comparison.className = 'answer-comparison';
    const yours = document.createElement('p');
    yours.textContent = `Your answer: ${answer.selectedLetter} — ${question.choices[answer.selectedLetter]}`;
    const correct = document.createElement('p');
    correct.textContent = `Best answer: ${question.correctLetter} — ${question.correctAnswer}`;
    comparison.append(yours, correct);
    const explanation = document.createElement('p');
    explanation.className = 'missed-explanation';
    explanation.textContent = question.explanation;
    const context = document.createElement('p');
    context.className = 'missed-context';
    context.textContent = question.context;
    const details = document.createElement('details');
    details.className = 'source-drawer compact-source-drawer';
    const summary = document.createElement('summary');
    summary.textContent = 'Review verification sources';
    const list = document.createElement('ul');
    list.className = 'source-list';
    renderSourceList(list, question.sourceIds);
    details.append(summary, list);
    card.append(meta, heading, comparison, explanation, context, details);
    ui.missedReview.append(card);
  }
}

function renderHistory() {
  const history = readJsonStorage(storageKey('history'), []);
  ui.historyList.replaceChildren();
  if (!history.length) {
    const empty = document.createElement('p');
    empty.className = 'empty-state';
    empty.textContent = 'No completed runs saved on this device yet.';
    ui.historyList.append(empty);
    return;
  }
  for (const run of history) {
    const item = document.createElement('article');
    item.className = 'history-item';
    const heading = document.createElement('div');
    heading.className = 'history-item-heading';
    const score = document.createElement('strong');
    score.textContent = `${run.percent}% · ${run.rank || rankForPercent(run.percent)}`;
    const date = document.createElement('span');
    date.textContent = new Date(run.completedAt).toLocaleDateString();
    heading.append(score, date);
    const detail = document.createElement('p');
    detail.textContent = `${run.correct}/${run.answered} correct · ${run.modeLabel} · ${run.bestStreak} best streak`;
    item.append(heading, detail);
    ui.historyList.append(item);
  }
}

function practiceMissedQuestions() {
  const misses = new Set(state.answers.filter((answer) => !answer.correct).map((answer) => answer.questionId));
  const pool = state.questions.filter((question) => misses.has(question.id));
  if (!pool.length) return;
  startSession(seededShuffle(pool, `${Date.now()}-missed`), { mode: 'missed' });
}

function modeLabel() {
  if (state.runMode === 'daily') return 'Daily 10';
  if (state.runMode === 'missed') return 'Missed review';
  if (state.runMode === 'balanced') return 'Balanced Mix';
  return 'Random Mix';
}

function showResults() {
  ui.quiz.hidden = true;
  ui.results.hidden = false;
  const percent = state.possible ? Math.round((state.score / state.possible) * 100) : 0;
  const accuracy = state.answered ? Math.round((state.correct / state.answered) * 100) : 0;
  const rank = rankForPercent(percent);
  const bestPercent = updateBestScore(percent);

  ui.resultScore.textContent = `${state.score} / ${state.possible} points (${percent}%)`;
  ui.resultRank.textContent = rank;
  ui.resultAccuracy.textContent = `${accuracy}%`;
  ui.resultStreak.textContent = String(state.bestStreak);
  ui.resultBest.textContent = `${bestPercent}%`;
  ui.resultDetail.textContent = `${state.correct} of ${state.answered} correct · ${modeLabel()}${state.dailyKey ? ` · ${state.dailyKey.split('|')[0]}` : ''}.`;

  renderCategoryResults();
  renderStudyRecommendation();
  renderMissedReview();
  saveHistory({
    completedAt: new Date().toISOString(),
    datasetVersion: state.manifest?.datasetVersion || 'current',
    mode: state.runMode,
    modeLabel: modeLabel(),
    rank,
    percent,
    score: state.score,
    possible: state.possible,
    correct: state.correct,
    answered: state.answered,
    bestStreak: state.bestStreak
  });
  renderHistory();
  ui.results.scrollIntoView({ behavior: 'smooth', block: 'start' });
  ui.restart.focus({ preventScroll: true });
  announce(`Challenge complete. Score ${state.score} out of ${state.possible} points, ${percent} percent.`);
}

async function shareResult() {
  const percent = state.possible ? Math.round((state.score / state.possible) * 100) : 0;
  const text = `I scored ${percent}% (${state.score}/${state.possible} pts) on High IQ — Test Higher Cognition at DTF Genetics. ${modeLabel()}`;
  const shareData = { title: 'High IQ — Test Higher Cognition', text, url: 'https://dtfseeds.com/games/high-iq/' };
  try {
    if (navigator.share) {
      await navigator.share(shareData);
      announce('Score shared.');
      return;
    }
    await navigator.clipboard.writeText(`${text} ${shareData.url}`);
    ui.shareScore.textContent = 'Copied';
    setTimeout(() => { ui.shareScore.textContent = 'Share score'; }, 1600);
    announce('Score copied to clipboard.');
  } catch (error) {
    if (error?.name !== 'AbortError') announce('Sharing was unavailable on this device.');
  }
}

function restartQuiz() {
  ui.results.hidden = true;
  ui.quiz.hidden = true;
  ui.setup.hidden = false;
  updateCountOptions(10);
  ui.setup.scrollIntoView({ behavior: 'smooth', block: 'start' });
  ui.start.focus({ preventScroll: true });
}

function renderTopicMap() {
  ui.topicMap.replaceChildren();
  const counts = state.manifest?.categoryCounts || {};
  const max = Math.max(...Object.values(counts), 1);
  for (const [category, count] of Object.entries(counts).sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))) {
    const card = document.createElement('article');
    const heading = document.createElement('div');
    heading.className = 'topic-map-heading';
    const name = document.createElement('h3');
    name.textContent = category;
    const number = document.createElement('span');
    number.textContent = `${count} questions`;
    heading.append(name, number);
    const meter = document.createElement('div');
    meter.className = 'topic-meter';
    const fill = document.createElement('span');
    fill.style.width = `${Math.round((count / max) * 100)}%`;
    meter.append(fill);
    card.append(heading, meter);
    ui.topicMap.append(card);
  }
}

function renderCoverageMaps() {
  ui.difficultyMap.replaceChildren();
  const counts = state.manifest?.difficultyCounts || {};
  const max = Math.max(...Object.values(counts), 1);
  for (const difficulty of DIFFICULTIES) {
    if (!counts[difficulty]) continue;
    const row = document.createElement('div');
    row.className = 'coverage-row';
    const heading = document.createElement('div');
    heading.className = 'coverage-heading';
    const name = document.createElement('strong');
    name.textContent = difficulty;
    const detail = document.createElement('span');
    detail.textContent = `${counts[difficulty]} questions · ${POINTS[difficulty]} pts each`;
    heading.append(name, detail);
    const meter = document.createElement('div');
    meter.className = 'coverage-meter';
    const fill = document.createElement('span');
    fill.style.width = `${Math.round((counts[difficulty] / max) * 100)}%`;
    meter.append(fill);
    row.append(heading, meter);
    ui.difficultyMap.append(row);
  }

  ui.sourceMap.replaceChildren();
  const sourceTypes = {};
  for (const source of state.sources.values()) {
    const key = source.organizationType || 'Reference';
    sourceTypes[key] = (sourceTypes[key] || 0) + 1;
  }
  for (const [type, count] of Object.entries(sourceTypes).sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))) {
    const row = document.createElement('div');
    row.className = 'source-type-row';
    const name = document.createElement('span');
    name.textContent = type;
    const number = document.createElement('strong');
    number.textContent = String(count);
    row.append(name, number);
    ui.sourceMap.append(row);
  }
}

function updateHeroStats() {
  ui.heroQuestionCount.textContent = String(state.questions.length);
  ui.heroCategoryCount.textContent = String(Object.keys(state.manifest?.categoryCounts || {}).length);
  ui.heroSourceCount.textContent = String(state.sources.size);
  ui.heroVersion.textContent = String(state.manifest?.datasetVersion || '—');
}

function showDataError(errors) {
  ui.dataHealthDot.className = 'data-health-dot error';
  ui.loading.textContent = 'Verified question bank unavailable';
  ui.dataErrorDetail.hidden = false;
  ui.dataErrorDetail.textContent = errors.join(' · ');
  ui.fallback.hidden = false;
  ui.setup.hidden = true;
  announce('High IQ question data could not be loaded. Retry is available.');
}

async function loadProductionBank() {
  ui.fallback.hidden = true;
  ui.dataErrorDetail.hidden = true;
  ui.dataErrorDetail.textContent = '';
  ui.dataHealthDot.className = 'data-health-dot loading';
  ui.loading.textContent = 'Loading verified question data…';
  state.loadErrors = [];

  for (const base of candidateDataBases()) {
    try {
      const loaded = await loadFromBase(base);
      state.manifest = loaded.manifest;
      state.dataBase = base;
      state.questions = loaded.questions;
      state.sources = new Map(loaded.sources.map((source) => [source.id, source]));
      populateFilters();
      updateHeroStats();
      renderTopicMap();
      renderCoverageMaps();
      renderHistory();
      ui.setup.hidden = false;
      ui.dataHealthDot.className = 'data-health-dot ready';
      ui.loading.textContent = `Verified bank ready · v${state.manifest.datasetVersion} · ${state.questions.length} questions · ${state.sources.size} sources`;
      announce('High IQ verified question bank is ready.');
      return true;
    } catch (error) {
      console.warn(error);
      state.loadErrors.push(error.message);
    }
  }
  showDataError(state.loadErrors);
  return false;
}

function handleKeyboard(event) {
  if (ui.quiz.hidden) return;
  const tag = document.activeElement?.tagName?.toLowerCase();
  if (tag === 'input' || tag === 'select' || tag === 'textarea') return;
  if (!state.locked) {
    const key = event.key.toUpperCase();
    const digitMap = { '1': 'A', '2': 'B', '3': 'C', '4': 'D' };
    const letter = LETTERS.includes(key) ? key : digitMap[event.key];
    if (letter) {
      const button = ui.answers.querySelector(`[data-letter="${letter}"]`);
      if (button) {
        event.preventDefault();
        button.click();
        button.focus();
      }
      return;
    }
    if (event.key === 'Enter' && state.selectedLetter) {
      event.preventDefault();
      lockAnswer();
    }
  } else if (event.key === 'Enter') {
    event.preventDefault();
    nextQuestion();
  }
}

function wireEvents() {
  ui.category.addEventListener('change', () => updateCountOptions());
  ui.difficulty.addEventListener('change', () => updateCountOptions());
  ui.mode.addEventListener('change', () => syncPresetButtons());
  ui.count.addEventListener('change', syncPresetButtons);
  for (const button of ui.presetButtons) {
    button.addEventListener('click', () => {
      updateCountOptions(Number.parseInt(button.dataset.presetCount || '10', 10));
      syncPresetButtons();
    });
  }
  ui.start.addEventListener('click', startQuiz);
  ui.daily.addEventListener('click', startDaily);
  ui.dailyHero.addEventListener('click', (event) => {
    event.preventDefault();
    startDaily();
  });
  ui.lock.addEventListener('click', lockAnswer);
  ui.next.addEventListener('click', nextQuestion);
  ui.restart.addEventListener('click', restartQuiz);
  ui.practiceMissed.addEventListener('click', practiceMissedQuestions);
  ui.shareScore.addEventListener('click', shareResult);
  ui.retry.addEventListener('click', loadProductionBank);
  ui.clearHistory.addEventListener('click', () => {
    try { localStorage.removeItem(storageKey('history')); } catch {}
    renderHistory();
    announce('Local High IQ run history cleared.');
  });
  document.addEventListener('keydown', handleKeyboard);
}

async function initialize() {
  assertUi();
  wireEvents();
  await loadProductionBank();
  console.info('High IQ v3 runtime initialized');
}

initialize().catch((error) => {
  console.error(error);
  showDataError([error.message]);
});
