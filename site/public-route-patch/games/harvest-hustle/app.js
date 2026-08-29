import {
  SHIFT_ALPHABET,
  advanceTime,
  applyStation,
  createShift,
  expectedStationId,
  isValidShiftCode,
  normalizeShiftCode,
  shiftRank
} from './engine.mjs';

const ui = {
  load: document.querySelector('#load-status'),
  timer: document.querySelector('#time-stat'),
  score: document.querySelector('#score-stat'),
  combo: document.querySelector('#combo-stat'),
  completed: document.querySelector('#completed-stat'),
  mistakes: document.querySelector('#mistakes-stat'),
  start: document.querySelector('#start-shift'),
  queue: document.querySelector('#queue'),
  stations: document.querySelector('#stations'),
  selected: document.querySelector('#selected-batch'),
  feedback: document.querySelector('#feedback'),
  history: document.querySelector('#history'),
  code: document.querySelector('#shift-code'),
  newCode: document.querySelector('#new-code'),
  share: document.querySelector('#share-shift'),
  announce: document.querySelector('#announce')
};

let data = null;
let state = null;
let selectedInstanceId = null;
let running = false;
let clockId = null;
let batchById = new Map();
let stationById = new Map();

function escapeHtml(value = '') {
  return String(value).replace(/[&<>"']/g, (character) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
  }[character]));
}

function randomCode() {
  const values = new Uint32Array(6);
  crypto.getRandomValues(values);
  return [...values].map((number) => SHIFT_ALPHABET[number % SHIFT_ALPHABET.length]).join('');
}

function setCode(value) {
  const normalized = normalizeShiftCode(value);
  ui.code.value = normalized;
  ui.code.setAttribute('aria-invalid', String(normalized.length > 0 && !isValidShiftCode(normalized)));
}

function challengeUrl() {
  const params = new URLSearchParams({ shift: state.code });
  return `${location.origin}${location.pathname}?${params}`;
}

function stopClock() {
  if (clockId !== null) window.clearInterval(clockId);
  clockId = null;
}

function startClock() {
  stopClock();
  if (!running || state?.status !== 'playing' || document.hidden) return;
  clockId = window.setInterval(() => {
    state = advanceTime(state, 1, data);
    if (state.status !== 'playing') {
      running = false;
      stopClock();
    }
    render();
    if (state.status === 'complete') {
      ui.announce.textContent = `Shift complete. ${state.completed} batches finished. Rank ${shiftRank(state)}.`;
    } else if (state.timeRemaining <= 10) {
      ui.announce.textContent = `${state.timeRemaining} seconds left.`;
    }
  }, 1000);
}

function selectedBatch() {
  return state?.queue.find((batch) => batch.instanceId === selectedInstanceId) ?? null;
}

function ensureSelection() {
  if (!selectedBatch()) selectedInstanceId = state?.queue[0]?.instanceId ?? null;
}

function renderStats() {
  ui.timer.textContent = `${state.timeRemaining}s`;
  ui.score.textContent = String(state.score);
  ui.combo.textContent = `x${state.combo}`;
  ui.completed.textContent = String(state.completed);
  ui.mistakes.textContent = String(state.mistakes);
  ui.start.disabled = running || state.status !== 'playing';
  ui.start.textContent = state.status === 'complete' ? 'Shift Complete' : running ? 'Shift Running' : state.elapsed > 0 ? 'Resume Shift' : 'Start Shift';
  document.body.classList.toggle('shift-running', running);
  document.body.classList.toggle('shift-complete', state.status === 'complete');
}

function stepTrack(batch, definition) {
  return definition.steps.map((step, index) => {
    const station = stationById.get(step);
    const stateClass = index < batch.stepIndex ? ' done' : index === batch.stepIndex ? ' current' : '';
    return `<span class="step-chip${stateClass}">${escapeHtml(station?.short ?? step)}</span>`;
  }).join('');
}

function batchArt(definition) {
  const initial = definition.label.slice(0, 1).toUpperCase();
  return `
    <span class="batch-art" aria-hidden="true">
      <span class="crate-lid"></span>
      <span class="crate-face">${escapeHtml(initial)}</span>
      <span class="crop-dot dot-a"></span><span class="crop-dot dot-b"></span><span class="crop-dot dot-c"></span>
    </span>`;
}

function renderQueue() {
  ensureSelection();
  ui.queue.replaceChildren();
  for (const batch of state.queue) {
    const definition = batchById.get(batch.batchId);
    if (!definition) continue;
    const expected = stationById.get(expectedStationId(batch, data));
    const button = document.createElement('button');
    button.type = 'button';
    button.className = `batch-card${batch.instanceId === selectedInstanceId ? ' selected' : ''}${batch.quality <= 60 ? ' stressed' : ''}`;
    button.dataset.batch = batch.instanceId;
    button.setAttribute('aria-pressed', String(batch.instanceId === selectedInstanceId));
    const patienceLabel = batch.patienceRemaining >= 0 ? `${batch.patienceRemaining}s buffer` : `${Math.abs(batch.patienceRemaining)}s late`;
    button.innerHTML = `
      ${batchArt(definition)}
      <span class="batch-copy">
        <span class="batch-topline"><strong>${escapeHtml(definition.label)}</strong><small>${escapeHtml(definition.theme)}</small></span>
        <span class="quality-line"><span>Quality ${batch.quality}%</span><span>${escapeHtml(patienceLabel)}</span></span>
        <span class="quality-track"><span style="width:${batch.quality}%"></span></span>
        <span class="step-track">${stepTrack(batch, definition)}</span>
        <span class="next-step">NEXT · ${escapeHtml(expected?.label ?? 'Complete')}</span>
      </span>`;
    ui.queue.append(button);
  }
}

function renderSelected() {
  const batch = selectedBatch();
  if (!batch) {
    ui.selected.innerHTML = '<strong>No batch selected.</strong><span>Choose a batch from the conveyor.</span>';
    return;
  }
  const definition = batchById.get(batch.batchId);
  const expected = stationById.get(expectedStationId(batch, data));
  ui.selected.innerHTML = `<strong>${escapeHtml(definition?.label ?? batch.batchId)}</strong><span>Next station: ${escapeHtml(expected?.label ?? 'Complete')} · Quality ${batch.quality}%</span>`;
}

function renderStations() {
  ui.stations.replaceChildren();
  data.stations.forEach((station, index) => {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = `station-button station-${station.id}`;
    button.dataset.station = station.id;
    button.disabled = !running || state.status !== 'playing' || !selectedBatch();
    button.innerHTML = `
      <span class="station-key" aria-hidden="true">${index + 1}</span>
      <span class="station-mark" aria-hidden="true">${escapeHtml(station.mark)}</span>
      <span><strong>${escapeHtml(station.label)}</strong><small>${escapeHtml(station.description)}</small></span>`;
    ui.stations.append(button);
  });
}

function renderFeedback() {
  if (state.status === 'complete') {
    const rank = shiftRank(state);
    ui.feedback.className = 'feedback-card complete';
    ui.feedback.innerHTML = `<span class="feedback-kicker">SHIFT COMPLETE</span><strong>${escapeHtml(rank)}</strong><p>${state.completed} batches · ${state.score} points · best combo x${state.bestCombo} · ${state.mistakes} mistakes.</p>`;
    return;
  }
  if (!state.lastAction) {
    ui.feedback.className = 'feedback-card';
    ui.feedback.innerHTML = `<span class="feedback-kicker">READY</span><strong>${running ? 'Match the selected batch to its NEXT station.' : 'Choose a batch, then start the shift.'}</strong><p>Correct moves build combo. A wrong station costs time and game quality.</p>`;
    return;
  }
  const action = state.lastAction;
  const definition = batchById.get(action.batchId);
  const station = stationById.get(action.stationId);
  if (action.correct) {
    ui.feedback.className = `feedback-card correct${action.completedBatch ? ' completed' : ''}`;
    const completion = action.completedBatch ? ` Batch finished for +${action.completionScore}.` : '';
    ui.feedback.innerHTML = `<span class="feedback-kicker">${action.completedBatch ? 'BATCH BANKED' : 'GOOD MOVE'}</span><strong>${escapeHtml(definition?.label ?? action.batchId)} → ${escapeHtml(station?.label ?? action.stationId)}</strong><p>+${action.stepScore} step points.${completion} Combo x${action.combo}.</p>`;
  } else {
    const expected = stationById.get(action.expectedStationId);
    ui.feedback.className = 'feedback-card wrong';
    ui.feedback.innerHTML = `<span class="feedback-kicker">WRONG STATION</span><strong>${escapeHtml(definition?.label ?? action.batchId)} needed ${escapeHtml(expected?.label ?? action.expectedStationId)}.</strong><p>-${action.qualityPenalty} game quality and a 3-second penalty. Combo reset.</p>`;
  }
}

function renderHistory() {
  ui.history.replaceChildren();
  if (!state.history.length) {
    const item = document.createElement('li');
    item.className = 'empty-state';
    item.textContent = 'Shift actions will appear here.';
    ui.history.append(item);
    return;
  }
  for (const action of [...state.history].slice(-8).reverse()) {
    const definition = batchById.get(action.batchId);
    const station = stationById.get(action.stationId);
    const item = document.createElement('li');
    item.className = action.correct ? 'history-good' : 'history-bad';
    item.innerHTML = `<span>${action.elapsed}s</span><div><strong>${escapeHtml(definition?.label ?? action.batchId)}</strong><small>${escapeHtml(station?.short ?? action.stationId)} · ${action.correct ? 'correct' : 'wrong'}${action.completedBatch ? ' · completed' : ''}</small></div>`;
    ui.history.append(item);
  }
}

function render() {
  ensureSelection();
  renderStats();
  renderQueue();
  renderSelected();
  renderStations();
  renderFeedback();
  renderHistory();
}

function resetShift(code) {
  stopClock();
  running = false;
  state = createShift({ code }, data);
  selectedInstanceId = state.queue[0]?.instanceId ?? null;
  setCode(state.code);
  window.history.replaceState(null, '', challengeUrl());
  render();
}

function runStation(stationId) {
  if (!running || state?.status !== 'playing') return;
  const batch = selectedBatch();
  if (!batch) return;
  const previousIndex = state.queue.findIndex((candidate) => candidate.instanceId === batch.instanceId);
  try {
    state = applyStation(state, { instanceId: batch.instanceId, stationId }, data);
    if (state.lastAction.completedBatch) {
      const next = state.queue[Math.min(previousIndex, state.queue.length - 1)] ?? state.queue[0];
      selectedInstanceId = next?.instanceId ?? null;
    }
    if (state.status === 'complete') {
      running = false;
      stopClock();
    }
    render();
    const station = stationById.get(stationId);
    ui.announce.textContent = state.lastAction.correct
      ? `${station?.label ?? stationId} correct. Combo ${state.combo}. ${state.timeRemaining} seconds remain.`
      : `Wrong station. Combo reset. ${state.timeRemaining} seconds remain.`;
  } catch (error) {
    console.error(error);
    ui.announce.textContent = error.message;
  }
}

ui.start.addEventListener('click', () => {
  if (!state || state.status !== 'playing' || running) return;
  running = true;
  startClock();
  render();
  ui.announce.textContent = `Shift started. ${state.timeRemaining} seconds on the clock.`;
});

ui.queue.addEventListener('click', (event) => {
  const button = event.target.closest('button[data-batch]');
  if (!button) return;
  selectedInstanceId = button.dataset.batch;
  renderQueue();
  renderSelected();
  renderStations();
  const definition = batchById.get(selectedBatch()?.batchId);
  ui.announce.textContent = `${definition?.label ?? 'Batch'} selected.`;
});

ui.stations.addEventListener('click', (event) => {
  const button = event.target.closest('button[data-station]');
  if (!button || button.disabled) return;
  runStation(button.dataset.station);
});

document.addEventListener('keydown', (event) => {
  if (event.altKey || event.ctrlKey || event.metaKey || event.shiftKey) return;
  const target = event.target;
  if (target instanceof HTMLInputElement || target instanceof HTMLTextAreaElement || target instanceof HTMLSelectElement) return;
  const index = Number(event.key) - 1;
  if (index >= 0 && index < data?.stations?.length) {
    event.preventDefault();
    runStation(data.stations[index].id);
  }
});

ui.code.addEventListener('input', () => setCode(ui.code.value));
ui.code.addEventListener('keydown', (event) => {
  if (event.key !== 'Enter') return;
  if (!isValidShiftCode(ui.code.value)) {
    ui.announce.textContent = 'Enter a complete six-character shift code.';
    return;
  }
  resetShift(ui.code.value);
  ui.announce.textContent = `Shift code ${state.code} loaded. Press Start Shift when ready.`;
});

ui.newCode.addEventListener('click', () => {
  resetShift(randomCode());
  ui.announce.textContent = `New shift code ${state.code}. Press Start Shift when ready.`;
});

ui.share.addEventListener('click', async () => {
  const url = challengeUrl();
  const text = `Harvest Hustle · shift ${state.code}\n${url}`;
  try {
    await navigator.clipboard.writeText(text);
    ui.announce.textContent = 'Harvest Hustle challenge copied.';
  } catch {
    ui.announce.textContent = `Share shift ${state.code}: ${url}`;
  }
});

document.addEventListener('visibilitychange', () => {
  if (document.hidden) {
    stopClock();
  } else if (running && state?.status === 'playing') {
    startClock();
  }
});

async function load() {
  try {
    const response = await fetch('./data/shift.json', { cache: 'no-store', credentials: 'same-origin' });
    if (!response.ok) throw new Error(`shift data HTTP ${response.status}`);
    data = await response.json();
    if (data.schemaVersion !== 1 || data.stations?.length !== 4 || data.batches?.length < 10 || data.shiftSeconds !== 75) {
      throw new Error('Harvest Hustle data contract mismatch');
    }
    batchById = new Map(data.batches.map((batch) => [batch.id, batch]));
    stationById = new Map(data.stations.map((station) => [station.id, station]));
    const requested = normalizeShiftCode(new URLSearchParams(location.search).get('shift'));
    const code = isValidShiftCode(requested) ? requested : randomCode();
    state = createShift({ code }, data);
    selectedInstanceId = state.queue[0]?.instanceId ?? null;
    setCode(code);
    window.history.replaceState(null, '', challengeUrl());
    ui.load.textContent = '75-second arcade shift · 4 stations · deterministic batch queue';
    render();
  } catch (error) {
    console.error(error);
    ui.load.textContent = 'Harvest Hustle could not load its shift data.';
    ui.start.disabled = true;
  }
}

load();
