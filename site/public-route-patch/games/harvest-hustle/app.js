const SHIFT_CODE_LENGTH = 6;
const SHIFT_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
const CORRECT_ACTION_SECONDS = 1;
const WRONG_ACTION_SECONDS = 3;
const WRONG_QUALITY_PENALTY = 10;
const LATE_QUALITY_DECAY_PER_SECOND = 2;
const MAX_HISTORY = 14;
const BATCH_KEYS = ['q', 'w', 'e', 'r'];

const ui = {
  load: document.querySelector('#load-status'),
  timer: document.querySelector('#time-stat'),
  score: document.querySelector('#score-stat'),
  combo: document.querySelector('#combo-stat'),
  completed: document.querySelector('#completed-stat'),
  mistakes: document.querySelector('#mistakes-stat'),
  start: document.querySelector('#start-shift'),
  progress: document.querySelector('.shift-progress'),
  progressFill: document.querySelector('#shift-progress-fill'),
  queue: document.querySelector('#queue'),
  stations: document.querySelector('#stations'),
  selected: document.querySelector('#selected-batch'),
  feedback: document.querySelector('#feedback'),
  history: document.querySelector('#history'),
  code: document.querySelector('#shift-code'),
  newCode: document.querySelector('#new-code'),
  share: document.querySelector('#share-shift'),
  controlState: document.querySelector('#control-state'),
  announce: document.querySelector('#announce')
};

let data = null;
let state = null;
let selectedInstanceId = null;
let running = false;
let clockId = null;
let clockAnchor = 0;
let feedbackFlashTimer = null;
let batchById = new Map();
let stationById = new Map();

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
  if (!payload?.stations?.length || !payload?.batches?.length || !Number.isInteger(payload?.shiftSeconds)) {
    throw new Error('Harvest Hustle shift data is required.');
  }
}

function stationMap(payload) {
  return new Map(payload.stations.map((station) => [station.id, station]));
}

function batchMap(payload) {
  return new Map(payload.batches.map((batch) => [batch.id, batch]));
}

function normalizeShiftCode(value) {
  const allowed = new Set(SHIFT_ALPHABET);
  return String(value ?? '')
    .trim()
    .toUpperCase()
    .split('')
    .filter((character) => allowed.has(character))
    .join('')
    .slice(0, SHIFT_CODE_LENGTH);
}

function isValidShiftCode(value) {
  return normalizeShiftCode(value).length === SHIFT_CODE_LENGTH;
}

function batchIdForIndex(code, index, payload) {
  requireData(payload);
  if (!Number.isInteger(index) || index < 0) throw new Error('Batch index must be a non-negative integer.');
  const length = payload.batches.length;
  let selected = 0;
  let previous = -1;
  for (let cursor = 0; cursor <= index; cursor += 1) {
    selected = hash(`${code}:batch:${cursor}`) % length;
    if (length > 1 && selected === previous) selected = (selected + 1) % length;
    previous = selected;
  }
  return payload.batches[selected].id;
}

function createBatchInstance(code, arrivalIndex, payload) {
  const definition = batchMap(payload).get(batchIdForIndex(code, arrivalIndex, payload));
  if (!definition) throw new Error('Unknown batch definition.');
  return {
    instanceId: `${arrivalIndex}-${definition.id}`,
    batchId: definition.id,
    arrivalIndex,
    stepIndex: 0,
    quality: 100,
    patienceRemaining: definition.patience,
    maxPatience: definition.patience
  };
}

function expectedStationId(batch, payload) {
  const definition = batchMap(payload).get(batch?.batchId);
  if (!definition) return null;
  return definition.steps[batch.stepIndex] ?? null;
}

function appendHistory(inputState, event) {
  inputState.history.push(event);
  if (inputState.history.length > MAX_HISTORY) inputState.history = inputState.history.slice(-MAX_HISTORY);
}

function finishIfNeeded(inputState) {
  if (inputState.timeRemaining <= 0) {
    inputState.timeRemaining = 0;
    inputState.status = 'complete';
  }
  return inputState;
}

function advanceTime(inputState, seconds, payload) {
  requireData(payload);
  const next = clone(inputState);
  if (next.status !== 'playing') return next;
  const amount = Math.max(0, Math.min(next.timeRemaining, Math.floor(Number(seconds) || 0)));
  if (!amount) return finishIfNeeded(next);

  next.timeRemaining -= amount;
  next.elapsed += amount;

  for (const batch of next.queue) {
    const beforeLate = Math.max(0, -batch.patienceRemaining);
    batch.patienceRemaining -= amount;
    const afterLate = Math.max(0, -batch.patienceRemaining);
    const newLateSeconds = Math.max(0, afterLate - beforeLate);
    if (newLateSeconds) {
      batch.quality = Math.max(0, batch.quality - newLateSeconds * LATE_QUALITY_DECAY_PER_SECOND);
    }
  }

  return finishIfNeeded(next);
}

function spawnReplacement(inputState, payload) {
  if (inputState.status !== 'playing') return inputState;
  while (inputState.queue.length < payload.queueSize) {
    inputState.queue.push(createBatchInstance(inputState.code, inputState.nextBatchIndex, payload));
    inputState.nextBatchIndex += 1;
  }
  return inputState;
}

function createShift({ code } = {}, payload) {
  requireData(payload);
  const normalized = normalizeShiftCode(code);
  if (!isValidShiftCode(normalized)) throw new Error('A six-character shift code is required.');

  const next = {
    schemaVersion: 1,
    code: normalized,
    status: 'playing',
    timeRemaining: payload.shiftSeconds,
    elapsed: 0,
    score: 0,
    combo: 0,
    bestCombo: 0,
    completed: 0,
    mistakes: 0,
    queue: [],
    nextBatchIndex: 0,
    lastAction: null,
    history: []
  };

  spawnReplacement(next, payload);
  return next;
}

function applyStation(inputState, { instanceId, stationId } = {}, payload) {
  requireData(payload);
  if (inputState.status !== 'playing') throw new Error('This shift is already complete.');
  if (!stationMap(payload).has(stationId)) throw new Error(`Unknown station: ${stationId}`);

  let next = clone(inputState);
  const queueIndex = next.queue.findIndex((batch) => batch.instanceId === instanceId);
  if (queueIndex < 0) throw new Error(`Unknown batch instance: ${instanceId}`);

  const batch = next.queue[queueIndex];
  const definition = batchMap(payload).get(batch.batchId);
  const expected = definition?.steps[batch.stepIndex];
  if (!definition || !expected) throw new Error('Batch step contract is invalid.');

  const correct = stationId === expected;
  let completedBatch = null;
  let stepScore = 0;
  let completionScore = 0;
  let qualityPenalty = 0;

  if (correct) {
    next.combo += 1;
    next.bestCombo = Math.max(next.bestCombo, next.combo);
    stepScore = 10 + Math.min(next.combo, 10) * 2;
    next.score += stepScore;
    batch.stepIndex += 1;

    if (batch.stepIndex >= definition.steps.length) {
      completionScore = Math.round(definition.value * (batch.quality / 100)) + next.combo * 3;
      next.score += completionScore;
      next.completed += 1;
      completedBatch = {
        instanceId: batch.instanceId,
        batchId: batch.batchId,
        quality: batch.quality,
        value: definition.value
      };
      next.queue.splice(queueIndex, 1);
    }
  } else {
    next.mistakes += 1;
    next.combo = 0;
    qualityPenalty = Math.min(batch.quality, WRONG_QUALITY_PENALTY);
    batch.quality -= qualityPenalty;
  }

  const actionSeconds = correct ? CORRECT_ACTION_SECONDS : WRONG_ACTION_SECONDS;
  next = advanceTime(next, actionSeconds, payload);
  if (completedBatch && next.status === 'playing') spawnReplacement(next, payload);

  const event = {
    elapsed: next.elapsed,
    instanceId,
    batchId: definition.id,
    stationId,
    expectedStationId: expected,
    correct,
    stepScore,
    completionScore,
    qualityPenalty,
    completedBatch,
    combo: next.combo,
    score: next.score,
    timeRemaining: next.timeRemaining
  };
  next.lastAction = event;
  appendHistory(next, event);
  return next;
}

function shiftRank(inputState) {
  if (!inputState || inputState.completed <= 0) return 'Rookie';
  const efficiency = inputState.score - inputState.mistakes * 50;
  if (inputState.completed >= 10 && efficiency >= 1800) return 'Room Captain';
  if (inputState.completed >= 7 && efficiency >= 1100) return 'Trim Ace';
  if (inputState.completed >= 4 && efficiency >= 600) return 'Shift Pro';
  return 'Hustler';
}

function escapeHtml(value = '') {
  return String(value).replace(/[&<>"']/g, (character) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
  }[character]));
}

function validateData(payload) {
  if (payload?.schemaVersion !== 1 || payload?.stations?.length !== 4 || payload?.batches?.length < 10 || payload?.shiftSeconds !== 75 || payload?.queueSize !== 4) {
    throw new Error('Harvest Hustle data contract mismatch.');
  }
  const stationIds = new Set(payload.stations.map((station) => station.id));
  const batchIds = new Set(payload.batches.map((batch) => batch.id));
  if (stationIds.size !== payload.stations.length || batchIds.size !== payload.batches.length) {
    throw new Error('Harvest Hustle data contains duplicate IDs.');
  }
  for (const batch of payload.batches) {
    if (!Array.isArray(batch.steps) || !batch.steps.length || batch.steps.some((step) => !stationIds.has(step))) {
      throw new Error(`Harvest Hustle batch ${batch.id} has an invalid station sequence.`);
    }
    if (!Number.isFinite(batch.patience) || batch.patience <= 0 || !Number.isFinite(batch.value) || batch.value <= 0) {
      throw new Error(`Harvest Hustle batch ${batch.id} has invalid scoring data.`);
    }
  }
}

function randomCode() {
  const values = new Uint32Array(SHIFT_CODE_LENGTH);
  if (globalThis.crypto?.getRandomValues) {
    globalThis.crypto.getRandomValues(values);
  } else {
    for (let index = 0; index < values.length; index += 1) values[index] = Math.floor(Math.random() * 0xffffffff);
  }
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

function replaceChallengeUrl() {
  try {
    globalThis.history?.replaceState?.(null, '', challengeUrl());
  } catch {
    // Gameplay must not fail because a browser blocks history mutation.
  }
}

function stopClock() {
  if (clockId !== null) window.clearInterval(clockId);
  clockId = null;
  clockAnchor = 0;
}

function settleClock() {
  if (!running || state?.status !== 'playing' || document.hidden) return;
  const now = Date.now();
  if (!clockAnchor) clockAnchor = now;
  const wholeSeconds = Math.floor((now - clockAnchor) / 1000);
  if (wholeSeconds <= 0) return;
  clockAnchor += wholeSeconds * 1000;
  state = advanceTime(state, wholeSeconds, data);
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
}

function startClock() {
  stopClock();
  if (!running || state?.status !== 'playing' || document.hidden) return;
  clockAnchor = Date.now();
  clockId = window.setInterval(settleClock, 250);
}

function selectedBatch() {
  return state?.queue.find((batch) => batch.instanceId === selectedInstanceId) ?? null;
}

function ensureSelection() {
  if (!selectedBatch()) selectedInstanceId = state?.queue[0]?.instanceId ?? null;
}

function selectBatchByIndex(index, announce = true) {
  const batch = state?.queue[index];
  if (!batch) return false;
  selectedInstanceId = batch.instanceId;
  renderQueue();
  renderSelected();
  renderStations();
  if (announce) {
    const definition = batchById.get(batch.batchId);
    ui.announce.textContent = `${definition?.label ?? 'Batch'} selected. Next station ${stationById.get(expectedStationId(batch, data))?.label ?? 'unknown'}.`;
  }
  return true;
}

function renderStats() {
  const percent = Math.max(0, Math.min(100, (state.timeRemaining / data.shiftSeconds) * 100));
  ui.timer.textContent = `${state.timeRemaining}s`;
  ui.score.textContent = String(state.score);
  ui.combo.textContent = `x${state.combo}`;
  ui.completed.textContent = String(state.completed);
  ui.mistakes.textContent = String(state.mistakes);
  ui.progressFill.style.width = `${percent}%`;
  ui.progress.setAttribute('aria-valuenow', String(state.timeRemaining));
  ui.start.disabled = state.status !== 'playing';
  ui.start.setAttribute('aria-pressed', String(running));
  ui.start.textContent = state.status === 'complete' ? 'Shift Complete' : running ? 'Pause Shift' : state.elapsed > 0 ? 'Resume Shift' : 'Start Shift';
  ui.code.disabled = running;
  ui.newCode.disabled = running;
  document.body.classList.toggle('shift-running', running);
  document.body.classList.toggle('shift-paused', !running && state.elapsed > 0 && state.status === 'playing');
  document.body.classList.toggle('shift-complete', state.status === 'complete');
  document.body.classList.toggle('timer-critical', state.status === 'playing' && state.timeRemaining <= 10);
  document.body.classList.toggle('combo-hot', state.combo >= 5);
  ui.controlState.textContent = state.status === 'complete' ? 'COMPLETE' : running ? 'LIVE' : state.elapsed > 0 ? 'PAUSED' : 'READY';
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
  state.queue.forEach((batch, index) => {
    const definition = batchById.get(batch.batchId);
    if (!definition) return;
    const expected = stationById.get(expectedStationId(batch, data));
    const shortcut = BATCH_KEYS[index] ?? null;
    const button = document.createElement('button');
    button.type = 'button';
    button.className = `batch-card${batch.instanceId === selectedInstanceId ? ' selected' : ''}${batch.quality <= 60 ? ' stressed' : ''}${batch.patienceRemaining <= 3 ? ' urgent' : ''}`;
    button.dataset.batch = batch.instanceId;
    button.setAttribute('aria-pressed', String(batch.instanceId === selectedInstanceId));
    button.setAttribute('aria-label', `${definition.label}. Quality ${batch.quality} percent. ${batch.patienceRemaining >= 0 ? `${batch.patienceRemaining} seconds buffer` : `${Math.abs(batch.patienceRemaining)} seconds late`}. Next station ${expected?.label ?? 'complete'}.`);
    if (shortcut) button.setAttribute('aria-keyshortcuts', shortcut.toUpperCase());
    const patienceLabel = batch.patienceRemaining >= 0 ? `${batch.patienceRemaining}s buffer` : `${Math.abs(batch.patienceRemaining)}s late`;
    const shortcutLabel = shortcut ? ` · ${shortcut.toUpperCase()}` : '';
    button.innerHTML = `
      ${batchArt(definition)}
      <span class="batch-copy">
        <span class="batch-topline"><strong>${escapeHtml(definition.label)}</strong><small>${escapeHtml(definition.theme)}${shortcutLabel}</small></span>
        <span class="quality-line"><span>Quality ${batch.quality}%</span><span>${escapeHtml(patienceLabel)}</span></span>
        <span class="quality-track"><span style="width:${batch.quality}%"></span></span>
        <span class="step-track">${stepTrack(batch, definition)}</span>
        <span class="next-step">NEXT · ${escapeHtml(expected?.label ?? 'Complete')}</span>
      </span>`;
    ui.queue.append(button);
  });
}

function renderSelected() {
  const batch = selectedBatch();
  if (!batch) {
    ui.selected.innerHTML = '<strong>No batch selected.</strong><span>Choose a batch from the conveyor.</span>';
    return;
  }
  const definition = batchById.get(batch.batchId);
  const expected = stationById.get(expectedStationId(batch, data));
  const queueIndex = state.queue.findIndex((candidate) => candidate.instanceId === batch.instanceId);
  const shortcut = BATCH_KEYS[queueIndex]?.toUpperCase();
  ui.selected.innerHTML = `<strong>${escapeHtml(definition?.label ?? batch.batchId)}</strong><span>Next station: ${escapeHtml(expected?.label ?? 'Complete')} · Quality ${batch.quality}%${shortcut ? ` · Batch key ${shortcut}` : ''}</span>`;
}

function renderStations() {
  ui.stations.replaceChildren();
  const batch = selectedBatch();
  const nextStationId = batch ? expectedStationId(batch, data) : null;
  data.stations.forEach((station, index) => {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = `station-button station-${station.id}${station.id === nextStationId ? ' next-station' : ''}`;
    button.dataset.station = station.id;
    button.disabled = !running || state.status !== 'playing' || !batch;
    button.setAttribute('aria-label', `${index + 1}. ${station.label}${station.id === nextStationId ? '. Next station for the selected batch.' : ''}`);
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
    ui.feedback.innerHTML = `<span class="feedback-kicker">${running ? 'SHIFT LIVE' : state.elapsed > 0 ? 'PAUSED' : 'READY'}</span><strong>${running ? 'Match the selected batch to its NEXT station.' : state.elapsed > 0 ? 'Resume when you are ready.' : 'Choose a batch, then start the shift.'}</strong><p>Use Q/W/E/R to select conveyor batches and 1–4 to send the selected batch to a station.</p>`;
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
  if (!state || !data) return;
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
  replaceChallengeUrl();
  render();
}

function flashResult(correct) {
  window.clearTimeout(feedbackFlashTimer);
  document.body.classList.remove('flash-correct', 'flash-wrong');
  void document.body.offsetWidth;
  document.body.classList.add(correct ? 'flash-correct' : 'flash-wrong');
  feedbackFlashTimer = window.setTimeout(() => document.body.classList.remove('flash-correct', 'flash-wrong'), 360);
  try {
    if (navigator.vibrate) navigator.vibrate(correct ? 18 : [28, 25, 28]);
  } catch {
    // Haptics are optional.
  }
}

function runStation(stationId) {
  if (!running || state?.status !== 'playing') return;
  const batch = selectedBatch();
  if (!batch) return;
  settleClock();
  if (state.status !== 'playing') return;
  const previousIndex = state.queue.findIndex((candidate) => candidate.instanceId === batch.instanceId);
  try {
    state = applyStation(state, { instanceId: batch.instanceId, stationId }, data);
    const action = state.lastAction;
    if (action.completedBatch) {
      const next = state.queue[Math.min(previousIndex, state.queue.length - 1)] ?? state.queue[0];
      selectedInstanceId = next?.instanceId ?? null;
    }
    if (state.status === 'complete') {
      running = false;
      stopClock();
    }
    flashResult(action.correct);
    render();
    const station = stationById.get(stationId);
    ui.announce.textContent = action.correct
      ? `${station?.label ?? stationId} correct. Combo ${state.combo}. ${state.timeRemaining} seconds remain.`
      : `Wrong station. Combo reset. ${state.timeRemaining} seconds remain.`;
  } catch (error) {
    console.error(error);
    ui.announce.textContent = error instanceof Error ? error.message : String(error);
  }
}

ui.start.addEventListener('click', () => {
  if (!state || state.status !== 'playing') return;
  if (running) {
    settleClock();
    running = false;
    stopClock();
    render();
    ui.announce.textContent = `Shift paused with ${state.timeRemaining} seconds remaining.`;
    return;
  }
  running = true;
  startClock();
  render();
  ui.announce.textContent = `${state.elapsed > 0 ? 'Shift resumed' : 'Shift started'}. ${state.timeRemaining} seconds on the clock. Use Q W E R for batches and 1 through 4 for stations.`;
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

  const batchIndex = BATCH_KEYS.indexOf(event.key.toLowerCase());
  if (batchIndex >= 0 && batchIndex < (state?.queue.length ?? 0)) {
    event.preventDefault();
    selectBatchByIndex(batchIndex);
    return;
  }

  const stationIndex = Number(event.key) - 1;
  if (stationIndex >= 0 && stationIndex < (data?.stations?.length ?? 0)) {
    event.preventDefault();
    runStation(data.stations[stationIndex].id);
  }
});

ui.code.addEventListener('input', () => setCode(ui.code.value));
ui.code.addEventListener('keydown', (event) => {
  if (event.key !== 'Enter' || running) return;
  if (!isValidShiftCode(ui.code.value)) {
    ui.announce.textContent = 'Enter a complete six-character shift code.';
    return;
  }
  resetShift(ui.code.value);
  ui.announce.textContent = `Shift code ${state.code} loaded. Press Start Shift when ready.`;
});

ui.newCode.addEventListener('click', () => {
  if (running) return;
  resetShift(randomCode());
  ui.announce.textContent = `New shift code ${state.code}. Press Start Shift when ready.`;
});

ui.share.addEventListener('click', async () => {
  const url = challengeUrl();
  const text = `Harvest Hustle · shift ${state.code}\n${url}`;
  try {
    if (!navigator.clipboard?.writeText) throw new Error('Clipboard unavailable');
    await navigator.clipboard.writeText(text);
    ui.announce.textContent = 'Harvest Hustle challenge copied.';
  } catch {
    ui.announce.textContent = `Share shift ${state.code}: ${url}`;
  }
});

document.addEventListener('visibilitychange', () => {
  if (document.hidden) {
    settleClock();
    stopClock();
  } else if (running && state?.status === 'playing') {
    startClock();
    ui.announce.textContent = `Shift resumed on screen with ${state.timeRemaining} seconds remaining.`;
  }
});

function load() {
  try {
    const embedded = document.querySelector('#harvest-shift-data');
    if (!embedded?.textContent) throw new Error('Embedded Harvest Hustle data is missing.');
    data = JSON.parse(embedded.textContent);
    validateData(data);
    batchById = new Map(data.batches.map((batch) => [batch.id, batch]));
    stationById = new Map(data.stations.map((station) => [station.id, station]));
    const requested = normalizeShiftCode(new URLSearchParams(location.search).get('shift'));
    const code = isValidShiftCode(requested) ? requested : randomCode();
    state = createShift({ code }, data);
    selectedInstanceId = state.queue[0]?.instanceId ?? null;
    setCode(code);
    replaceChallengeUrl();
    ui.load.textContent = 'Ready · 75-second shift · Q/W/E/R batches · 1–4 stations';
    render();
  } catch (error) {
    console.error(error);
    ui.load.textContent = 'Harvest Hustle could not initialize.';
    ui.start.disabled = true;
  }
}

window.addEventListener('pagehide', stopClock);
load();
