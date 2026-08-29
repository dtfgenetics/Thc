import {
  TRIAL_ALPHABET,
  advanceTrial,
  averageAccuracy,
  createTrial,
  isValidTrialCode,
  judgeRank,
  normalizeTrialCode
} from './engine.mjs';
import {
  MAX_CONFIDENCE_CALLS,
  submitConfidentScorecard
} from './confidence.mjs';

const ui = {
  load: document.querySelector('#load-status'),
  round: document.querySelector('#round-stat'),
  points: document.querySelector('#points-stat'),
  accuracy: document.querySelector('#accuracy-stat'),
  exact: document.querySelector('#exact-stat'),
  sample: document.querySelector('#sample-panel'),
  evidence: document.querySelector('#evidence-list'),
  scorecard: document.querySelector('#scorecard'),
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

function escapeHtml(value = '') {
  return String(value).replace(/[&<>"']/g, (character) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
  }[character]));
}

function randomCode() {
  const values = new Uint32Array(6);
  crypto.getRandomValues(values);
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

function resetDraft() {
  draftScores = Object.fromEntries(data.categories.map((category) => [category.id, 5]));
  confidenceIds = new Set();
}

function visualMarkup(entry) {
  const specks = Math.min(28, 7 + entry.visual.frost * 4 + entry.visual.mass);
  const frost = Array.from({ length: specks }, (_, index) => `<i style="--i:${index}"></i>`).join('');
  return `
    <div class="sample-visual hue-${escapeHtml(entry.visual.hue)} spread-${escapeHtml(entry.visual.spread)} mass-${entry.visual.mass}" aria-hidden="true">
      <span class="sample-stem"></span>
      <span class="sample-cluster cluster-a"></span>
      <span class="sample-cluster cluster-b"></span>
      <span class="sample-cluster cluster-c"></span>
      <span class="sample-cluster cluster-d"></span>
      <span class="frost-field">${frost}</span>
      <span class="loupe"><b></b></span>
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
    ui.sample.innerHTML = `
      <div class="final-badge" aria-hidden="true"><span>DTF</span><strong>${escapeHtml(judgeRank(state))}</strong></div>
      <div class="final-copy"><p class="eyebrow">Trial complete</p><h2>${escapeHtml(judgeRank(state))}</h2><p>Average accuracy ${averageAccuracy(state)}% · ${state.exactCalls} exact category calls · ${state.totalPoints} points.</p></div>`;
    return;
  }
  ui.sample.innerHTML = `
    <div class="sample-heading"><div><p class="eyebrow">Blind sample ${state.round}</p><h2>${escapeHtml(entry.label)}</h2><span class="sample-code">${escapeHtml(entry.codeName)}</span></div><span class="packet-chip">FICTIONAL ENTRY</span></div>
    ${visualMarkup(entry)}
    <p class="sample-caption">Use the evidence packet and the same 1–10 rubric every round. The visual is original game artwork, not a real specimen photograph.</p>`;
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

function renderScorecard() {
  ui.scorecard.replaceChildren();
  const judging = state.status === 'judging';
  for (const category of data.categories) {
    const row = document.createElement('div');
    row.className = 'score-row';
    const value = draftScores[category.id] ?? 5;
    const confident = confidenceIds.has(category.id);
    const confidenceDisabled = !judging || (!confident && confidenceIds.size >= MAX_CONFIDENCE_CALLS);
    row.innerHTML = `
      <div class="score-label">
        <label for="score-${escapeHtml(category.id)}">${escapeHtml(category.label)}</label>
        <button type="button" class="confidence-button" data-confidence="${escapeHtml(category.id)}" aria-pressed="${confident}" ${confidenceDisabled ? 'disabled' : ''}>${confident ? 'Confident ✓' : 'Mark confident'}</button>
        <p>${escapeHtml(category.rubric)}</p>
      </div>
      <div class="score-control">
        <output id="value-${escapeHtml(category.id)}" for="score-${escapeHtml(category.id)}">${value}</output>
        <input id="score-${escapeHtml(category.id)}" data-category="${escapeHtml(category.id)}" type="range" min="1" max="10" step="1" value="${value}" ${judging ? '' : 'disabled'} aria-label="${escapeHtml(category.label)} score, 1 to 10">
        <div class="scale-labels" aria-hidden="true"><span>1</span><span>5</span><span>10</span></div>
      </div>`;
    ui.scorecard.append(row);
  }
  ui.submit.disabled = !judging;
  ui.submit.hidden = state.status === 'complete';
  if (judging) {
    const remaining = MAX_CONFIDENCE_CALLS - confidenceIds.size;
    ui.submit.textContent = `Submit scorecard · ${confidenceIds.size}/${MAX_CONFIDENCE_CALLS} confidence calls`;
    ui.submit.setAttribute('aria-description', `${remaining} confidence call${remaining === 1 ? '' : 's'} still available.`);
  } else {
    ui.submit.textContent = 'Submit scorecard';
    ui.submit.removeAttribute('aria-description');
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
    ui.review.innerHTML = `
      <div class="review-summary complete-summary">
        <span class="accuracy-ring" style="--accuracy:${averageAccuracy(state)}"><strong>${averageAccuracy(state)}%</strong><small>AVG</small></span>
        <div><p class="eyebrow">Final ruling</p><h2>${escapeHtml(judgeRank(state))}</h2><p>${state.totalPoints} trial points · ${state.exactCalls} exact calls · ${state.nearCalls} near calls.</p></div>
      </div>`;
    ui.next.hidden = true;
    return;
  }

  const entry = currentEntry();
  const result = state.lastResult;
  ui.review.innerHTML = `
    <div class="review-summary">
      <span class="accuracy-ring" style="--accuracy:${result.accuracy}"><strong>${result.accuracy}%</strong><small>ACCURACY</small></span>
      <div><p class="eyebrow">Benchmark reveal</p><h2>+${result.points} points</h2><p>${result.exactCount} exact · ${result.nearCount} near · total error ${result.totalError}</p>${result.confidenceBonus ? `<p class="confidence-summary">Confidence bonus +${result.confidenceBonus}</p>` : '<p class="confidence-summary">No confidence bonus this round.</p>'}</div>
    </div>
    <div class="benchmark-grid">
      ${data.categories.map((category) => {
        const score = result.categories[category.id];
        const confident = result.confidenceIds?.includes(category.id);
        return `<article class="benchmark-row diff-${Math.min(score.difference, 3)}${confident ? ' confident' : ''}">
          <div><span>${escapeHtml(category.short)}</span><strong>${escapeHtml(category.label)}</strong>${confidenceLabel(result, category.id)}</div>
          <div class="score-pair"><span>You <b>${score.player}</b></span><span>Bench <b>${score.benchmark}</b></span><em>${differenceLabel(score.difference)}</em></div>
          <p>${escapeHtml(entry.notes[category.id])}</p>
        </article>`;
      }).join('')}
    </div>`;
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
  window.history.replaceState(null, '', challengeUrl());
  render();
}

ui.scorecard.addEventListener('click', (event) => {
  const button = event.target.closest('button[data-confidence]');
  if (!button || state.status !== 'judging') return;
  const categoryId = button.dataset.confidence;
  if (confidenceIds.has(categoryId)) {
    confidenceIds.delete(categoryId);
  } else if (confidenceIds.size < MAX_CONFIDENCE_CALLS) {
    confidenceIds.add(categoryId);
  } else {
    ui.announce.textContent = `You can mark at most ${MAX_CONFIDENCE_CALLS} confidence calls per round.`;
    return;
  }
  renderScorecard();
  const category = data.categories.find((item) => item.id === categoryId);
  ui.announce.textContent = confidenceIds.has(categoryId)
    ? `${category?.label ?? categoryId} marked confident. ${confidenceIds.size} of ${MAX_CONFIDENCE_CALLS} confidence calls used.`
    : `${category?.label ?? categoryId} confidence call removed.`;
});

ui.scorecard.addEventListener('input', (event) => {
  const input = event.target.closest('input[data-category]');
  if (!input || state.status !== 'judging') return;
  const value = Number(input.value);
  draftScores[input.dataset.category] = value;
  const output = document.querySelector(`#value-${CSS.escape(input.dataset.category)}`);
  if (output) output.value = String(value);
});

ui.submit.addEventListener('click', () => {
  if (state.status !== 'judging') return;
  try {
    state = submitConfidentScorecard(state, draftScores, [...confidenceIds], data);
    render();
    ui.review.scrollIntoView({ behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth', block: 'start' });
    ui.announce.textContent = `Scorecard submitted. ${state.lastResult.accuracy} percent accuracy, ${state.lastResult.exactCount} exact calls, ${state.lastResult.confidenceBonus} confidence bonus points.`;
  } catch (error) {
    console.error(error);
    ui.announce.textContent = error.message;
  }
});

ui.next.addEventListener('click', () => {
  if (state.status !== 'review') return;
  state = advanceTrial(state, data);
  if (state.status === 'judging') resetDraft();
  render();
  document.querySelector('#sample-panel')?.scrollIntoView({ behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth', block: 'start' });
  ui.announce.textContent = state.status === 'complete'
    ? `Trial complete. Rank ${judgeRank(state)}, average accuracy ${averageAccuracy(state)} percent.`
    : `Round ${state.round}. New blind sample ready. Confidence calls reset.`;
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
    await navigator.clipboard.writeText(text);
    ui.announce.textContent = 'Trial challenge copied.';
  } catch {
    ui.announce.textContent = `Share trial ${state.code}: ${url}`;
  }
});

async function loadJson(path) {
  const response = await fetch(path, { cache: 'no-store', credentials: 'same-origin' });
  if (!response.ok) throw new Error(`${path} HTTP ${response.status}`);
  return response.json();
}

async function load() {
  try {
    const [core, pack1, pack2, pack3, pack4] = await Promise.all([
      loadJson('./data/core.json'),
      loadJson('./data/entries-1.json'),
      loadJson('./data/entries-2.json'),
      loadJson('./data/entries-3.json'),
      loadJson('./data/entries-4.json')
    ]);
    data = { ...core, entries: [...pack1, ...pack2, ...pack3, ...pack4] };
    if (data.schemaVersion !== 1 || data.roundsPerRun !== 5 || data.categories?.length !== 7 || data.entries?.length !== 12) {
      throw new Error('Trichome Trials data contract mismatch');
    }
    entryById = new Map(data.entries.map((entry) => [entry.id, entry]));
    const requested = normalizeTrialCode(new URLSearchParams(location.search).get('trial'));
    const code = isValidTrialCode(requested) ? requested : randomCode();
    state = createTrial({ code }, data);
    resetDraft();
    setCode(code);
    window.history.replaceState(null, '', challengeUrl());
    ui.load.textContent = '5 blind rounds · 7 categories · 2 confidence calls per round';
    render();
  } catch (error) {
    console.error(error);
    ui.load.textContent = 'Trichome Trials could not load its judging deck.';
    ui.submit.disabled = true;
  }
}

load();
