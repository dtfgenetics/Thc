const TRIAL_CODE_LENGTH = 6;
const TRIAL_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
const SCORE_MIN = 1;
const SCORE_MAX = 10;
const MAX_CONFIDENCE_CALLS = 2;
const EXACT_CONFIDENCE_BONUS = 6;
const NEAR_CONFIDENCE_BONUS = 3;

const ui = {
  load: document.querySelector('#load-status'),
  round: document.querySelector('#round-stat'),
  points: document.querySelector('#points-stat'),
  accuracy: document.querySelector('#accuracy-stat'),
  exact: document.querySelector('#exact-stat'),
  sample: document.querySelector('#sample-panel'),
  evidence: document.querySelector('#evidence-list'),
  scorecard: document.querySelector('#scorecard'),
  progress: document.querySelector('#scorecard-progress'),
  submit: document.querySelector('#submit-card'),
  review: document.querySelector('#benchmark-review'),
  next: document.querySelector('#next-round'),
  history: document.querySelector('#trial-history'),
  code: document.querySelector('#trial-code'),
  newCode: document.querySelector('#new-code'),
  share: document.querySelector('#share-trial'),
  announce: document.querySelector('#announce')
};

let data = null;
let state = null;
let entryById = new Map();
let draftScores = {};
let confidenceIds = new Set();
let touchedIds = new Set();

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

function requireData(payload) {
  if (!payload?.categories?.length || !payload?.entries?.length || !Number.isInteger(payload?.roundsPerRun)) {
    throw new Error('Trichome Trials data is required.');
  }
  if (payload.roundsPerRun > payload.entries.length) throw new Error('roundsPerRun exceeds available entries.');
}

function entryMap(payload) {
  return new Map(payload.entries.map((entry) => [entry.id, entry]));
}

function normalizeTrialCode(value) {
  const allowed = new Set(TRIAL_ALPHABET);
  return String(value ?? '')
    .trim()
    .toUpperCase()
    .split('')
    .filter((character) => allowed.has(character))
    .join('')
    .slice(0, TRIAL_CODE_LENGTH);
}

function isValidTrialCode(value) {
  return normalizeTrialCode(value).length === TRIAL_CODE_LENGTH;
}

function trialEntryOrder(code, payload) {
  requireData(payload);
  const normalized = normalizeTrialCode(code);
  if (!isValidTrialCode(normalized)) throw new Error('A six-character trial code is required.');
  return payload.entries
    .map((entry) => ({ id: entry.id, seed: hash(`${normalized}:${entry.id}`) }))
    .sort((a, b) => a.seed - b.seed || a.id.localeCompare(b.id))
    .slice(0, payload.roundsPerRun)
    .map((item) => item.id);
}

function validateScorecard(scorecard, payload) {
  requireData(payload);
  if (!scorecard || typeof scorecard !== 'object') throw new Error('A complete scorecard is required.');
  const clean = {};
  for (const category of payload.categories) {
    const value = Number(scorecard[category.id]);
    if (!Number.isInteger(value) || value < SCORE_MIN || value > SCORE_MAX) {
      throw new Error(`${category.label} must be an integer from ${SCORE_MIN} to ${SCORE_MAX}.`);
    }
    clean[category.id] = value;
  }
  return clean;
}

function scoreScorecard(scorecard, benchmark, payload) {
  const clean = validateScorecard(scorecard, payload);
  let totalError = 0;
  let exactCount = 0;
  let nearCount = 0;
  const categories = {};

  for (const category of payload.categories) {
    const target = Number(benchmark?.[category.id]);
    if (!Number.isInteger(target) || target < SCORE_MIN || target > SCORE_MAX) {
      throw new Error(`Invalid benchmark score for ${category.id}.`);
    }
    const player = clean[category.id];
    const difference = Math.abs(player - target);
    totalError += difference;
    if (difference === 0) exactCount += 1;
    else if (difference === 1) nearCount += 1;
    categories[category.id] = { player, benchmark: target, difference };
  }

  const maxError = payload.categories.length * (SCORE_MAX - SCORE_MIN);
  const accuracy = Math.max(0, Math.round((1 - totalError / maxError) * 100));
  const points = accuracy + exactCount * 4 + nearCount * 2;
  return { scorecard: clean, totalError, accuracy, exactCount, nearCount, points, categories };
}

function createTrial({ code } = {}, payload) {
  requireData(payload);
  const normalized = normalizeTrialCode(code);
  if (!isValidTrialCode(normalized)) throw new Error('A six-character trial code is required.');
  const entryOrder = trialEntryOrder(normalized, payload);
  return {
    schemaVersion: 1,
    code: normalized,
    status: 'judging',
    round: 1,
    roundsTotal: entryOrder.length,
    entryOrder,
    currentEntryId: entryOrder[0],
    totalPoints: 0,
    accuracyTotal: 0,
    exactCalls: 0,
    nearCalls: 0,
    lastResult: null,
    history: []
  };
}

function submitScorecard(inputState, scorecard, payload) {
  requireData(payload);
  const next = clone(inputState);
  if (next.status !== 'judging') throw new Error('This trial is not accepting a scorecard.');
  const entry = entryMap(payload).get(next.currentEntryId);
  if (!entry) throw new Error(`Unknown current trial entry: ${next.currentEntryId}`);

  const scored = scoreScorecard(scorecard, entry.scores, payload);
  const result = {
    round: next.round,
    entryId: entry.id,
    accuracy: scored.accuracy,
    points: scored.points,
    exactCount: scored.exactCount,
    nearCount: scored.nearCount,
    totalError: scored.totalError,
    categories: scored.categories
  };

  next.totalPoints += scored.points;
  next.accuracyTotal += scored.accuracy;
  next.exactCalls += scored.exactCount;
  next.nearCalls += scored.nearCount;
  next.lastResult = result;
  next.history.push(result);
  next.status = 'review';
  return next;
}

function advanceTrial(inputState, payload) {
  requireData(payload);
  const next = clone(inputState);
  if (next.status !== 'review') throw new Error('Review the current scorecard before advancing.');
  if (next.round >= next.roundsTotal) {
    next.status = 'complete';
    next.currentEntryId = null;
    return next;
  }
  next.round += 1;
  next.currentEntryId = next.entryOrder[next.round - 1];
  next.lastResult = null;
  next.status = 'judging';
  return next;
}

function averageAccuracy(inputState) {
  if (!inputState?.history?.length) return 0;
  return Math.round(inputState.accuracyTotal / inputState.history.length);
}

function judgeRank(inputState) {
  const average = averageAccuracy(inputState);
  const exact = inputState?.exactCalls ?? 0;
  if (average >= 95 && exact >= 20) return 'Head Judge';
  if (average >= 88 && exact >= 12) return 'Senior Judge';
  if (average >= 78) return 'Trial Judge';
  if (average >= 65) return 'Scorekeeper';
  return 'Judge in Training';
}

function validateConfidenceIds(ids, payload) {
  if (!Array.isArray(ids)) throw new Error('Confidence calls must be an array.');
  const unique = [...new Set(ids)];
  if (unique.length !== ids.length) throw new Error('Confidence calls must be unique.');
  if (unique.length > MAX_CONFIDENCE_CALLS) throw new Error(`Choose at most ${MAX_CONFIDENCE_CALLS} confidence calls.`);
  const allowed = new Set(payload.categories.map((category) => category.id));
  for (const id of unique) {
    if (!allowed.has(id)) throw new Error(`Unknown confidence category: ${id}`);
  }
  return unique;
}

function confidenceBonusForResult(result, ids, payload) {
  const cleanIds = validateConfidenceIds(ids, payload);
  let bonus = 0;
  const calls = {};
  for (const id of cleanIds) {
    const category = result?.categories?.[id];
    if (!category) throw new Error(`Missing scored category for confidence call: ${id}`);
    const points = category.difference === 0 ? EXACT_CONFIDENCE_BONUS : category.difference === 1 ? NEAR_CONFIDENCE_BONUS : 0;
    calls[id] = { difference: category.difference, bonus: points };
    bonus += points;
  }
  return { bonus, calls, confidenceIds: cleanIds };
}

function submitConfidentScorecard(inputState, scorecard, ids, payload) {
  const next = submitScorecard(inputState, scorecard, payload);
  const confidence = confidenceBonusForResult(next.lastResult, ids, payload);
  next.lastResult.confidenceIds = confidence.confidenceIds;
  next.lastResult.confidenceBonus = confidence.bonus;
  next.lastResult.confidenceCalls = confidence.calls;
  next.lastResult.points += confidence.bonus;
  next.totalPoints += confidence.bonus;
  next.history[next.history.length - 1] = next.lastResult;
  return next;
}

function escapeHtml(value = '') {
  return String(value).replace(/[&<>"']/g, (character) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
  }[character]));
}

function validateData(payload) {
  if (payload?.schemaVersion !== 1 || payload?.roundsPerRun !== 5 || payload?.categories?.length !== 7 || payload?.entries?.length !== 12) {
    throw new Error('Trichome Trials data contract mismatch.');
  }
  const categoryIds = new Set(payload.categories.map((category) => category.id));
  const entryIds = new Set(payload.entries.map((entry) => entry.id));
  if (categoryIds.size !== 7 || entryIds.size !== 12) throw new Error('Trichome Trials data contains duplicate IDs.');
  for (const entry of payload.entries) {
    if (!Array.isArray(entry.evidence) || entry.evidence.length !== payload.categories.length) {
      throw new Error(`${entry.id} must have one evidence line per category.`);
    }
    for (const category of payload.categories) {
      const score = Number(entry.scores?.[category.id]);
      if (!Number.isInteger(score) || score < SCORE_MIN || score > SCORE_MAX || typeof entry.notes?.[category.id] !== 'string') {
        throw new Error(`${entry.id} has an invalid ${category.id} benchmark contract.`);
      }
    }
  }
}

function randomCode() {
  const values = new Uint32Array(TRIAL_CODE_LENGTH);
  if (globalThis.crypto?.getRandomValues) globalThis.crypto.getRandomValues(values);
  else for (let index = 0; index < values.length; index += 1) values[index] = Math.floor(Math.random() * 0xffffffff);
  return [...values].map((number) => TRIAL_ALPHABET[number % TRIAL_ALPHABET.length]).join('');
}

function currentEntry() {
  return entryById.get(state?.currentEntryId) ?? null;
}

function setCode(value) {
  const normalized = normalizeTrialCode(value);
  ui.code.value = normalized;
  ui.code.setAttribute('aria-invalid', String(normalized.length > 0 && !isValidTrialCode(normalized)));
}

function challengeUrl() {
  const params = new URLSearchParams({ trial: state.code });
  return `${location.origin}${location.pathname}?${params}`;
}

function replaceChallengeUrl() {
  try { globalThis.history?.replaceState?.(null, '', challengeUrl()); } catch { /* optional browser feature */ }
}

function reducedMotion() {
  try { return Boolean(globalThis.matchMedia?.('(prefers-reduced-motion: reduce)').matches); } catch { return true; }
}

function safeScroll(element) {
  try { element?.scrollIntoView?.({ behavior: reducedMotion() ? 'auto' : 'smooth', block: 'start' }); } catch { element?.scrollIntoView?.(); }
}

function resetDraft() {
  draftScores = Object.fromEntries(data.categories.map((category) => [category.id, 5]));
  confidenceIds = new Set();
  touchedIds = new Set();
}

function visualMarkup(entry) {
  const specks = Math.min(28, 7 + entry.visual.frost * 4 + entry.visual.mass);
  const frost = Array.from({ length: specks }, (_, index) => `<i style="--i:${index}"></i>`).join('');
  return `
    <div class="sample-visual hue-${escapeHtml(entry.visual.hue)} spread-${escapeHtml(entry.visual.spread)} mass-${entry.visual.mass}" aria-hidden="true">
      <span class="sample-stem"></span><span class="sample-cluster cluster-a"></span><span class="sample-cluster cluster-b"></span><span class="sample-cluster cluster-c"></span><span class="sample-cluster cluster-d"></span>
      <span class="frost-field">${frost}</span><span class="loupe"><b></b></span>
    </div>`;
}

function renderStats() {
  ui.round.textContent = state.status === 'complete' ? `${state.roundsTotal} / ${state.roundsTotal}` : `${state.round} / ${state.roundsTotal}`;
  ui.points.textContent = String(state.totalPoints);
  ui.accuracy.textContent = `${averageAccuracy(state)}%`;
  ui.exact.textContent = String(state.exactCalls);
}

function renderSample() {
  const entry = currentEntry();
  if (!entry) {
    ui.sample.innerHTML = `<div class="final-badge" aria-hidden="true"><span>DTF</span><strong>${escapeHtml(judgeRank(state))}</strong></div><div class="final-copy"><p class="eyebrow">Trial complete</p><h2>${escapeHtml(judgeRank(state))}</h2><p>Average accuracy ${averageAccuracy(state)}% · ${state.exactCalls} exact category calls · ${state.totalPoints} points.</p></div>`;
    return;
  }
  ui.sample.innerHTML = `<div class="sample-heading"><div><p class="eyebrow">Blind sample ${state.round}</p><h2>${escapeHtml(entry.label)}</h2><span class="sample-code">${escapeHtml(entry.codeName)}</span></div><span class="packet-chip">FICTIONAL ENTRY</span></div>${visualMarkup(entry)}<p class="sample-caption">Use the evidence packet and the same 1–10 rubric every round. The visual is original game artwork, not a real specimen photograph.</p>`;
}

function renderEvidence() {
  ui.evidence.replaceChildren();
  const entry = currentEntry();
  if (!entry) {
    const item = document.createElement('li');
    item.className = 'empty-state';
    item.textContent = 'Trial complete. Load a new code to judge another five-sample run.';
    ui.evidence.append(item);
    return;
  }
  data.categories.forEach((category, index) => {
    const item = document.createElement('li');
    item.innerHTML = `<span>${index + 1}</span><div><strong>${escapeHtml(category.label)}</strong><p>${escapeHtml(entry.evidence[index])}</p></div>`;
    ui.evidence.append(item);
  });
}

function scorePercent(value) {
  return Math.round(((Number(value) - SCORE_MIN) / (SCORE_MAX - SCORE_MIN)) * 100);
}

function updateScorecardMeta() {
  const judging = state.status === 'judging';
  const reviewed = touchedIds.size;
  const allReviewed = reviewed === data.categories.length;
  ui.progress.textContent = `${reviewed} / ${data.categories.length} reviewed`;
  ui.progress.classList.toggle('complete', allReviewed);
  ui.submit.disabled = !judging || !allReviewed;
  ui.submit.hidden = state.status === 'complete';
  ui.submit.textContent = !judging ? 'Submit scorecard' : allReviewed ? `Submit scorecard · ${confidenceIds.size}/${MAX_CONFIDENCE_CALLS} confidence` : `Review ${data.categories.length - reviewed} more categor${data.categories.length - reviewed === 1 ? 'y' : 'ies'}`;

  for (const button of ui.scorecard.querySelectorAll('button[data-confidence]')) {
    const id = button.dataset.confidence;
    const confident = confidenceIds.has(id);
    const reviewedCategory = touchedIds.has(id);
    button.disabled = !judging || !reviewedCategory || (!confident && confidenceIds.size >= MAX_CONFIDENCE_CALLS);
    button.setAttribute('aria-pressed', String(confident));
    button.textContent = confident ? 'Confident ✓' : reviewedCategory ? 'Mark confident' : 'Review first';
  }
}

function renderScorecard() {
  ui.scorecard.replaceChildren();
  const judging = state.status === 'judging';
  for (const category of data.categories) {
    const row = document.createElement('div');
    const value = draftScores[category.id] ?? 5;
    const confident = confidenceIds.has(category.id);
    const reviewedCategory = touchedIds.has(category.id);
    row.className = `score-row${reviewedCategory ? ' reviewed' : ' unreviewed'}`;
    row.dataset.scoreRow = category.id;
    row.innerHTML = `
      <div class="score-label">
        <div class="score-label-top"><label for="score-${escapeHtml(category.id)}">${escapeHtml(category.label)}</label><span class="review-state">${reviewedCategory ? 'REVIEWED' : 'REVIEW'}</span></div>
        <button type="button" class="confidence-button" data-confidence="${escapeHtml(category.id)}" aria-pressed="${confident}" ${!judging || !reviewedCategory || (!confident && confidenceIds.size >= MAX_CONFIDENCE_CALLS) ? 'disabled' : ''}>${confident ? 'Confident ✓' : reviewedCategory ? 'Mark confident' : 'Review first'}</button>
        <p>${escapeHtml(category.rubric)}</p>
      </div>
      <div class="score-control">
        <div class="score-stepper">
          <button type="button" data-score-step="-1" data-category="${escapeHtml(category.id)}" ${judging ? '' : 'disabled'} aria-label="Decrease ${escapeHtml(category.label)} score">−</button>
          <output id="value-${escapeHtml(category.id)}" for="score-${escapeHtml(category.id)}">${value}</output>
          <button type="button" data-score-step="1" data-category="${escapeHtml(category.id)}" ${judging ? '' : 'disabled'} aria-label="Increase ${escapeHtml(category.label)} score">+</button>
        </div>
        <input id="score-${escapeHtml(category.id)}" data-category="${escapeHtml(category.id)}" type="range" min="1" max="10" step="1" value="${value}" ${judging ? '' : 'disabled'} aria-label="${escapeHtml(category.label)} score, 1 to 10" style="--score:${scorePercent(value)}%">
        <div class="scale-labels" aria-hidden="true"><span>1</span><span>5</span><span>10</span></div>
      </div>`;
    ui.scorecard.append(row);
  }
  updateScorecardMeta();
}

function setDraftScore(categoryId, value, announce = false) {
  if (state.status !== 'judging') return;
  const clean = Math.max(SCORE_MIN, Math.min(SCORE_MAX, Math.round(Number(value) || 5)));
  draftScores[categoryId] = clean;
  touchedIds.add(categoryId);
  const input = document.getElementById(`score-${categoryId}`);
  const output = document.getElementById(`value-${categoryId}`);
  const row = ui.scorecard.querySelector(`[data-score-row="${categoryId}"]`);
  if (input) {
    input.value = String(clean);
    input.style.setProperty('--score', `${scorePercent(clean)}%`);
  }
  if (output) output.value = String(clean);
  row?.classList.remove('unreviewed');
  row?.classList.add('reviewed');
  const stateLabel = row?.querySelector('.review-state');
  if (stateLabel) stateLabel.textContent = 'REVIEWED';
  updateScorecardMeta();
  if (announce) {
    const category = data.categories.find((item) => item.id === categoryId);
    ui.announce.textContent = `${category?.label ?? categoryId} score ${clean}. ${touchedIds.size} of ${data.categories.length} categories reviewed.`;
  }
}

function differenceLabel(difference) {
  if (difference === 0) return 'EXACT';
  if (difference === 1) return 'NEAR';
  return `OFF ${difference}`;
}

function confidenceLabel(result, categoryId) {
  const call = result.confidenceCalls?.[categoryId];
  if (!call) return '';
  return `<span class="confidence-chip">CONF +${call.bonus}</span>`;
}

function renderReview() {
  ui.review.replaceChildren();
  if (state.status === 'judging') {
    ui.review.hidden = true;
    ui.next.hidden = true;
    return;
  }
  ui.review.hidden = false;
  if (state.status === 'complete') {
    ui.review.innerHTML = `<div class="review-summary complete-summary"><span class="accuracy-ring" style="--accuracy:${averageAccuracy(state)}"><strong>${averageAccuracy(state)}%</strong><small>AVG</small></span><div><p class="eyebrow">Final ruling</p><h2>${escapeHtml(judgeRank(state))}</h2><p>${state.totalPoints} trial points · ${state.exactCalls} exact calls · ${state.nearCalls} near calls.</p></div></div>`;
    ui.next.hidden = true;
    return;
  }

  const entry = currentEntry();
  const result = state.lastResult;
  ui.review.innerHTML = `<div class="review-summary"><span class="accuracy-ring" style="--accuracy:${result.accuracy}"><strong>${result.accuracy}%</strong><small>ACCURACY</small></span><div><p class="eyebrow">Benchmark reveal</p><h2>+${result.points} points</h2><p>${result.exactCount} exact · ${result.nearCount} near · total error ${result.totalError}</p>${result.confidenceBonus ? `<p class="confidence-summary">Confidence bonus +${result.confidenceBonus}</p>` : '<p class="confidence-summary">No confidence bonus this round.</p>'}</div></div><div class="benchmark-grid">${data.categories.map((category) => { const score = result.categories[category.id]; const confident = result.confidenceIds?.includes(category.id); return `<article class="benchmark-row diff-${Math.min(score.difference, 3)}${confident ? ' confident' : ''}"><div><span>${escapeHtml(category.short)}</span><strong>${escapeHtml(category.label)}</strong>${confidenceLabel(result, category.id)}</div><div class="score-pair"><span>You <b>${score.player}</b></span><span>Bench <b>${score.benchmark}</b></span><em>${differenceLabel(score.difference)}</em></div><p>${escapeHtml(entry.notes[category.id])}</p></article>`; }).join('')}</div>`;
  ui.next.hidden = false;
  ui.next.textContent = state.round >= state.roundsTotal ? 'Finish trial' : 'Next sample';
}

function renderHistory() {
  ui.history.replaceChildren();
  if (!state.history.length) {
    const item = document.createElement('li');
    item.className = 'empty-state';
    item.textContent = 'Submitted scorecards will appear here.';
    ui.history.append(item);
    return;
  }
  for (const result of [...state.history].reverse()) {
    const entry = entryById.get(result.entryId);
    const item = document.createElement('li');
    const confidence = result.confidenceBonus ? ` · conf +${result.confidenceBonus}` : '';
    item.innerHTML = `<span>R${result.round}</span><div><strong>${escapeHtml(entry?.label ?? result.entryId)}</strong><small>${result.accuracy}% accuracy · +${result.points} · ${result.exactCount} exact${confidence}</small></div>`;
    ui.history.append(item);
  }
}

function render() {
  renderStats();
  renderSample();
  renderEvidence();
  renderScorecard();
  renderReview();
  renderHistory();
  document.body.classList.toggle('reviewing', state.status === 'review');
  document.body.classList.toggle('trial-complete', state.status === 'complete');
}

function resetTrial(code) {
  state = createTrial({ code }, data);
  resetDraft();
  setCode(state.code);
  replaceChallengeUrl();
  render();
}

ui.scorecard.addEventListener('click', (event) => {
  const step = event.target.closest('button[data-score-step][data-category]');
  if (step && state.status === 'judging') {
    const id = step.dataset.category;
    const delta = Number(step.dataset.scoreStep);
    setDraftScore(id, (draftScores[id] ?? 5) + delta, true);
    return;
  }

  const button = event.target.closest('button[data-confidence]');
  if (!button || state.status !== 'judging') return;
  const categoryId = button.dataset.confidence;
  if (!touchedIds.has(categoryId)) {
    ui.announce.textContent = 'Review this category score before marking it confident.';
    return;
  }
  if (confidenceIds.has(categoryId)) confidenceIds.delete(categoryId);
  else if (confidenceIds.size < MAX_CONFIDENCE_CALLS) confidenceIds.add(categoryId);
  else {
    ui.announce.textContent = `You can mark at most ${MAX_CONFIDENCE_CALLS} confidence calls per round.`;
    return;
  }
  updateScorecardMeta();
  const category = data.categories.find((item) => item.id === categoryId);
  ui.announce.textContent = confidenceIds.has(categoryId) ? `${category?.label ?? categoryId} marked confident. ${confidenceIds.size} of ${MAX_CONFIDENCE_CALLS} confidence calls used.` : `${category?.label ?? categoryId} confidence call removed.`;
});

ui.scorecard.addEventListener('input', (event) => {
  const input = event.target.closest('input[data-category]');
  if (!input || state.status !== 'judging') return;
  setDraftScore(input.dataset.category, Number(input.value));
});

ui.scorecard.addEventListener('change', (event) => {
  const input = event.target.closest('input[data-category]');
  if (!input || state.status !== 'judging') return;
  const category = data.categories.find((item) => item.id === input.dataset.category);
  ui.announce.textContent = `${category?.label ?? input.dataset.category} score ${input.value}. ${touchedIds.size} of ${data.categories.length} categories reviewed.`;
});

ui.submit.addEventListener('click', () => {
  if (state.status !== 'judging') return;
  if (touchedIds.size !== data.categories.length) {
    ui.announce.textContent = `Review all ${data.categories.length} categories before submitting.`;
    return;
  }
  try {
    state = submitConfidentScorecard(state, draftScores, [...confidenceIds], data);
    render();
    safeScroll(ui.review);
    ui.announce.textContent = `Scorecard submitted. ${state.lastResult.accuracy} percent accuracy, ${state.lastResult.exactCount} exact calls, ${state.lastResult.confidenceBonus} confidence bonus points.`;
  } catch (error) {
    console.error(error);
    ui.announce.textContent = error instanceof Error ? error.message : String(error);
  }
});

ui.next.addEventListener('click', () => {
  if (state.status !== 'review') return;
  state = advanceTrial(state, data);
  if (state.status === 'judging') resetDraft();
  render();
  safeScroll(ui.sample);
  ui.announce.textContent = state.status === 'complete' ? `Trial complete. Rank ${judgeRank(state)}, average accuracy ${averageAccuracy(state)} percent.` : `Round ${state.round}. New blind sample ready. Confidence calls reset.`;
});

ui.code.addEventListener('input', () => setCode(ui.code.value));
ui.code.addEventListener('keydown', (event) => {
  if (event.key !== 'Enter') return;
  if (!isValidTrialCode(ui.code.value)) {
    ui.announce.textContent = 'Enter a complete six-character trial code.';
    return;
  }
  resetTrial(ui.code.value);
  ui.announce.textContent = `Trial ${state.code} loaded.`;
});

ui.newCode.addEventListener('click', () => {
  resetTrial(randomCode());
  ui.announce.textContent = `New trial code ${state.code}.`;
});

ui.share.addEventListener('click', async () => {
  const url = challengeUrl();
  const text = `Trichome Trials · code ${state.code}\n${url}`;
  try {
    if (!navigator.clipboard?.writeText) throw new Error('Clipboard unavailable');
    await navigator.clipboard.writeText(text);
    ui.announce.textContent = 'Trial challenge copied.';
  } catch {
    ui.announce.textContent = `Share trial ${state.code}: ${url}`;
  }
});

function load() {
  try {
    const embedded = document.querySelector('#trichome-trials-data');
    if (!embedded?.textContent) throw new Error('Embedded Trichome Trials data is missing.');
    data = JSON.parse(embedded.textContent);
    validateData(data);
    entryById = new Map(data.entries.map((entry) => [entry.id, entry]));
    const requested = normalizeTrialCode(new URLSearchParams(location.search).get('trial'));
    const code = isValidTrialCode(requested) ? requested : randomCode();
    state = createTrial({ code }, data);
    resetDraft();
    setCode(code);
    replaceChallengeUrl();
    ui.load.textContent = 'Ready · 5 blind rounds · 7 categories · 2 confidence calls';
    render();
  } catch (error) {
    console.error(error);
    ui.load.textContent = 'Trichome Trials could not initialize.';
    ui.submit.disabled = true;
  }
}

load();
