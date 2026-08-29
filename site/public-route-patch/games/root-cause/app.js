import {
  ROOT_ALPHABET,
  ROOT_CODE_LENGTH,
  MAX_INSPECTIONS,
  MAX_GUESSES,
  createRun,
  currentCase,
  inspect,
  diagnose,
  advanceCase,
  normalizeRootCode,
  isValidRootCode,
  runGrade
} from './engine.mjs';

const ui = Object.fromEntries([
  'load-status','round-stat','score-stat','solved-stat','inspection-stat','case-stage','case-title','case-summary','environment','plant-visual','symptoms','evidence','guess-status','feedback','next-case','inspections','diagnoses','case-code','new-code','share-run','history','announce'
].map((id) => [id, document.getElementById(id)]));

let data;
let state;
const diagnosisById = new Map();

function randomCode() {
  const bytes = new Uint32Array(ROOT_CODE_LENGTH);
  crypto.getRandomValues(bytes);
  return [...bytes].map((value) => ROOT_ALPHABET[value % ROOT_ALPHABET.length]).join('');
}

function codeFromUrl() {
  const value = new URLSearchParams(location.search).get('case');
  return isValidRootCode(value) ? normalizeRootCode(value) : randomCode();
}

function syncUrl() {
  const url = new URL(location.href);
  url.searchParams.set('case', state.code);
  history.replaceState(null, '', url);
}

function diagnosisLabel(id) {
  return diagnosisById.get(id)?.label ?? id;
}

function escapeText(value) {
  const span = document.createElement('span');
  span.textContent = String(value);
  return span.innerHTML;
}

function startRun(code) {
  state = createRun({ code }, data);
  ui['case-code'].value = state.code;
  ui['case-code'].setAttribute('aria-invalid', 'false');
  syncUrl();
  render();
  ui.announce.textContent = `Root Cause run ${state.code} started.`;
}

function renderEnvironment(gameCase) {
  ui.environment.replaceChildren(...gameCase.environment.map((item) => {
    const chip = document.createElement('span');
    chip.className = 'reading-chip';
    chip.textContent = item;
    return chip;
  }));
}

function renderSymptoms(gameCase) {
  ui.symptoms.replaceChildren(...gameCase.symptoms.map((item) => {
    const li = document.createElement('li');
    li.textContent = item;
    return li;
  }));
}

function renderEvidence(gameCase) {
  if (!state.current.inspectionIds.length) {
    ui.evidence.innerHTML = '<p class="empty-state">No inspections yet. You may diagnose immediately for maximum points.</p>';
    return;
  }
  const selected = state.current.inspectionIds.map((id) => gameCase.inspections.find((item) => item.id === id)).filter(Boolean);
  ui.evidence.replaceChildren(...selected.map((item, index) => {
    const article = document.createElement('article');
    article.className = 'evidence-item';
    article.innerHTML = `<span>INSPECTION ${index + 1}</span><strong>${escapeText(item.label)}</strong><p>${escapeText(item.result)}</p>`;
    return article;
  }));
}

function renderInspections(gameCase) {
  const locked = state.current.status !== 'active';
  const atLimit = state.current.inspectionIds.length >= MAX_INSPECTIONS;
  ui.inspections.replaceChildren(...state.current.inspections.map((id) => {
    const item = gameCase.inspections.find((candidate) => candidate.id === id);
    const used = state.current.inspectionIds.includes(id);
    const button = document.createElement('button');
    button.type = 'button';
    button.className = `inspection-button${used ? ' used' : ''}`;
    button.textContent = used ? `✓ ${item.label}` : item.label;
    button.disabled = locked || used || atLimit;
    button.addEventListener('click', () => {
      state = inspect(state, id, data);
      ui.announce.textContent = `${item.label}: ${item.result}`;
      render();
    });
    return button;
  }));
}

function renderDiagnoses(gameCase) {
  const locked = state.current.status !== 'active';
  ui.diagnoses.replaceChildren(...state.current.diagnoses.map((id) => {
    const guessed = state.current.guesses.includes(id);
    const button = document.createElement('button');
    button.type = 'button';
    button.className = `diagnosis-button${guessed ? ' guessed' : ''}`;
    button.innerHTML = `<span>${escapeText(diagnosisById.get(id)?.family ?? 'Diagnosis')}</span><strong>${escapeText(diagnosisLabel(id))}</strong>`;
    button.disabled = locked || guessed;
    button.addEventListener('click', () => {
      state = diagnose(state, id, data);
      const wasCorrect = id === gameCase.diagnosisId;
      ui.announce.textContent = wasCorrect ? `Correct: ${diagnosisLabel(id)}.` : `Not the strongest fit: ${diagnosisLabel(id)}.`;
      render();
    });
    return button;
  }));
}

function renderFeedback(gameCase) {
  const guessesLeft = MAX_GUESSES - state.current.guesses.length;
  ui['guess-status'].textContent = `${guessesLeft} ${guessesLeft === 1 ? 'guess' : 'guesses'} available`;
  ui['next-case'].hidden = true;

  if (state.current.status === 'solved') {
    ui.feedback.className = 'feedback-card success';
    ui.feedback.innerHTML = `<span class="feedback-kicker">ROOT CAUSE FOUND</span><strong>${escapeText(diagnosisLabel(gameCase.diagnosisId))} · +${state.current.earned} points</strong><p>${escapeText(gameCase.explanation)}</p>`;
    ui['next-case'].hidden = false;
    ui['next-case'].textContent = state.roundIndex + 1 >= state.caseOrder.length ? 'Finish run' : 'Next case';
    return;
  }

  if (state.current.status === 'failed') {
    ui.feedback.className = 'feedback-card danger';
    ui.feedback.innerHTML = `<span class="feedback-kicker">CASE MISSED</span><strong>The root cause was ${escapeText(diagnosisLabel(gameCase.diagnosisId))}.</strong><p>${escapeText(gameCase.explanation)}</p>`;
    ui['next-case'].hidden = false;
    ui['next-case'].textContent = state.roundIndex + 1 >= state.caseOrder.length ? 'Finish run' : 'Next case';
    return;
  }

  ui.feedback.className = 'feedback-card';
  if (state.current.guesses.length === 1) {
    ui.feedback.innerHTML = '<span class="feedback-kicker">RECHECK THE PATTERN</span><strong>That diagnosis does not explain the full case.</strong><p>Use the remaining inspections if needed, then make your final diagnosis.</p>';
  } else {
    ui.feedback.innerHTML = '<span class="feedback-kicker">CASE OPEN</span><strong>Start with the pattern, not a single leaf.</strong><p>Run up to two inspections or make a diagnosis now.</p>';
  }
}

function renderHistory() {
  if (!state.history.length) {
    ui.history.innerHTML = '<li class="empty-state">Completed cases will appear here.</li>';
    return;
  }
  ui.history.replaceChildren(...state.history.slice().reverse().map((entry) => {
    const gameCase = data.cases.find((item) => item.id === entry.caseId);
    const li = document.createElement('li');
    li.className = entry.status === 'solved' ? 'solved' : 'failed';
    li.innerHTML = `<span>${escapeText(gameCase?.title ?? entry.caseId)}</span><strong>${entry.status === 'solved' ? `+${entry.earned}` : 'Missed'}</strong>`;
    return li;
  }));
}

function renderComplete() {
  const grade = runGrade(state);
  ui['round-stat'].textContent = `${state.caseOrder.length} / ${state.caseOrder.length}`;
  ui['score-stat'].textContent = state.score;
  ui['solved-stat'].textContent = `${state.solved} / ${state.caseOrder.length}`;
  ui['inspection-stat'].textContent = '—';
  ui['case-stage'].textContent = 'Run complete';
  ui['case-title'].textContent = grade;
  ui['case-summary'].textContent = `You solved ${state.solved} of ${state.caseOrder.length} cases for ${state.score} points.`;
  ui.environment.innerHTML = '<span class="reading-chip">CASE FILE CLOSED</span>';
  ui['plant-visual'].dataset.visual = 'normal';
  ui.symptoms.innerHTML = '<li>Replay the same code to improve your score.</li><li>Use a new code for a different six-case sequence.</li><li>Share the challenge and compare diagnostic decisions.</li>';
  ui.evidence.innerHTML = '<p class="empty-state">Run complete. Evidence from completed cases remains in the run log.</p>';
  ui['guess-status'].textContent = 'Run complete';
  ui.inspections.innerHTML = '<p class="empty-state">Start a new run to inspect another case.</p>';
  ui.diagnoses.innerHTML = '<p class="empty-state">No active diagnosis board.</p>';
  ui.feedback.className = 'feedback-card success';
  ui.feedback.innerHTML = `<span class="feedback-kicker">${escapeText(grade.toUpperCase())}</span><strong>${state.score} total points</strong><p>Strong diagnostics come from matching several clues, not chasing one symptom.</p>`;
  ui['next-case'].hidden = true;
  renderHistory();
}

function render() {
  ui['score-stat'].textContent = state.score;
  ui['solved-stat'].textContent = `${state.solved} / ${state.caseOrder.length}`;
  if (state.status === 'complete') return renderComplete();

  const gameCase = currentCase(state, data);
  ui['round-stat'].textContent = `${state.roundIndex + 1} / ${state.caseOrder.length}`;
  ui['inspection-stat'].textContent = `${state.current.inspectionIds.length} / ${MAX_INSPECTIONS}`;
  ui['case-stage'].textContent = gameCase.stage;
  ui['case-title'].textContent = gameCase.title;
  ui['case-summary'].textContent = gameCase.summary;
  ui['plant-visual'].dataset.visual = gameCase.visual;
  renderEnvironment(gameCase);
  renderSymptoms(gameCase);
  renderEvidence(gameCase);
  renderInspections(gameCase);
  renderDiagnoses(gameCase);
  renderFeedback(gameCase);
  renderHistory();
}

ui['next-case'].addEventListener('click', () => {
  state = advanceCase(state, data);
  render();
  ui.announce.textContent = state.status === 'complete' ? `Run complete. ${state.score} points.` : `Case ${state.roundIndex + 1} opened.`;
  document.querySelector('.case-card')?.scrollIntoView({ behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth', block: 'start' });
});

ui['case-code'].addEventListener('input', () => {
  const normalized = normalizeRootCode(ui['case-code'].value);
  ui['case-code'].value = normalized;
  ui['case-code'].setAttribute('aria-invalid', String(normalized.length > 0 && normalized.length !== ROOT_CODE_LENGTH));
});

ui['case-code'].addEventListener('keydown', (event) => {
  if (event.key !== 'Enter') return;
  if (!isValidRootCode(ui['case-code'].value)) {
    ui['case-code'].setAttribute('aria-invalid', 'true');
    ui.announce.textContent = 'Enter a full six-character case code.';
    return;
  }
  startRun(ui['case-code'].value);
});

ui['new-code'].addEventListener('click', () => startRun(randomCode()));
ui['share-run'].addEventListener('click', async () => {
  const url = new URL(location.href);
  url.searchParams.set('case', state.code);
  try {
    await navigator.clipboard.writeText(url.toString());
    ui['share-run'].textContent = 'Link copied';
  } catch {
    ui['share-run'].textContent = state.code;
  }
  setTimeout(() => { ui['share-run'].textContent = 'Copy challenge link'; }, 1800);
});

async function boot() {
  try {
    const response = await fetch('./data/cases.json', { cache: 'no-store' });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    data = await response.json();
    if (data.cases?.length !== 12) throw new Error('Expected 12 case files.');
    if (data.diagnoses?.length !== 12) throw new Error('Expected 12 diagnoses.');
    data.diagnoses.forEach((item) => diagnosisById.set(item.id, item));
    ui['load-status'].textContent = 'Lab online';
    ui['load-status'].classList.add('ready');
    startRun(codeFromUrl());
  } catch (error) {
    console.error(error);
    ui['load-status'].textContent = 'Case data unavailable';
    ui.feedback.className = 'feedback-card danger';
    ui.feedback.innerHTML = '<span class="feedback-kicker">LOAD ERROR</span><strong>Root Cause could not open the case bank.</strong><p>Return to the Game Hub and try again.</p>';
  }
}

boot();
