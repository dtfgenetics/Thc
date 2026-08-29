export const SHIFT_CODE_LENGTH = 6;
export const SHIFT_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
export const CORRECT_ACTION_SECONDS = 1;
export const WRONG_ACTION_SECONDS = 3;
export const WRONG_QUALITY_PENALTY = 10;
export const LATE_QUALITY_DECAY_PER_SECOND = 2;
export const MAX_HISTORY = 14;

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

function requireData(data) {
  if (!data?.stations?.length || !data?.batches?.length || !Number.isInteger(data?.shiftSeconds)) {
    throw new Error('Harvest Hustle shift data is required.');
  }
}

function stationMap(data) {
  return new Map(data.stations.map((station) => [station.id, station]));
}

function batchMap(data) {
  return new Map(data.batches.map((batch) => [batch.id, batch]));
}

export function normalizeShiftCode(value) {
  const allowed = new Set(SHIFT_ALPHABET);
  return String(value ?? '')
    .trim()
    .toUpperCase()
    .split('')
    .filter((character) => allowed.has(character))
    .join('')
    .slice(0, SHIFT_CODE_LENGTH);
}

export function isValidShiftCode(value) {
  return normalizeShiftCode(value).length === SHIFT_CODE_LENGTH;
}

export function batchIdForIndex(code, index, data) {
  requireData(data);
  if (!Number.isInteger(index) || index < 0) throw new Error('Batch index must be a non-negative integer.');
  const length = data.batches.length;
  let selected = hash(`${code}:batch:${index}`) % length;
  if (index > 0) {
    const previous = hash(`${code}:batch:${index - 1}`) % length;
    if (selected === previous) selected = (selected + 1) % length;
  }
  return data.batches[selected].id;
}

export function createBatchInstance(code, arrivalIndex, data) {
  const definition = batchMap(data).get(batchIdForIndex(code, arrivalIndex, data));
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

export function expectedStationId(batch, data) {
  const definition = batchMap(data).get(batch?.batchId);
  if (!definition) return null;
  return definition.steps[batch.stepIndex] ?? null;
}

function appendHistory(state, event) {
  state.history.push(event);
  if (state.history.length > MAX_HISTORY) state.history = state.history.slice(-MAX_HISTORY);
}

function finishIfNeeded(state) {
  if (state.timeRemaining <= 0) {
    state.timeRemaining = 0;
    state.status = 'complete';
  }
  return state;
}

export function advanceTime(inputState, seconds, data) {
  requireData(data);
  const state = clone(inputState);
  if (state.status !== 'playing') return state;
  const amount = Math.max(0, Math.min(state.timeRemaining, Math.floor(Number(seconds) || 0)));
  if (!amount) return finishIfNeeded(state);

  state.timeRemaining -= amount;
  state.elapsed += amount;

  for (const batch of state.queue) {
    const beforeLate = Math.max(0, -batch.patienceRemaining);
    batch.patienceRemaining -= amount;
    const afterLate = Math.max(0, -batch.patienceRemaining);
    const newLateSeconds = Math.max(0, afterLate - beforeLate);
    if (newLateSeconds) {
      batch.quality = Math.max(0, batch.quality - newLateSeconds * LATE_QUALITY_DECAY_PER_SECOND);
    }
  }

  return finishIfNeeded(state);
}

function spawnReplacement(state, data) {
  if (state.status !== 'playing') return state;
  while (state.queue.length < data.queueSize) {
    state.queue.push(createBatchInstance(state.code, state.nextBatchIndex, data));
    state.nextBatchIndex += 1;
  }
  return state;
}

export function createShift({ code } = {}, data) {
  requireData(data);
  const normalized = normalizeShiftCode(code);
  if (!isValidShiftCode(normalized)) throw new Error('A six-character shift code is required.');

  const state = {
    schemaVersion: 1,
    code: normalized,
    status: 'playing',
    timeRemaining: data.shiftSeconds,
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

  spawnReplacement(state, data);
  return state;
}

export function applyStation(inputState, { instanceId, stationId } = {}, data) {
  requireData(data);
  if (inputState.status !== 'playing') throw new Error('This shift is already complete.');
  if (!stationMap(data).has(stationId)) throw new Error(`Unknown station: ${stationId}`);

  let state = clone(inputState);
  const queueIndex = state.queue.findIndex((batch) => batch.instanceId === instanceId);
  if (queueIndex < 0) throw new Error(`Unknown batch instance: ${instanceId}`);

  const batch = state.queue[queueIndex];
  const definition = batchMap(data).get(batch.batchId);
  const expected = definition?.steps[batch.stepIndex];
  if (!definition || !expected) throw new Error('Batch step contract is invalid.');

  const correct = stationId === expected;
  let completedBatch = null;
  let stepScore = 0;
  let completionScore = 0;
  let qualityPenalty = 0;

  if (correct) {
    state.combo += 1;
    state.bestCombo = Math.max(state.bestCombo, state.combo);
    stepScore = 10 + Math.min(state.combo, 10) * 2;
    state.score += stepScore;
    batch.stepIndex += 1;

    if (batch.stepIndex >= definition.steps.length) {
      completionScore = Math.round(definition.value * (batch.quality / 100)) + state.combo * 3;
      state.score += completionScore;
      state.completed += 1;
      completedBatch = {
        instanceId: batch.instanceId,
        batchId: batch.batchId,
        quality: batch.quality,
        value: definition.value
      };
      state.queue.splice(queueIndex, 1);
    }
  } else {
    state.mistakes += 1;
    state.combo = 0;
    qualityPenalty = Math.min(batch.quality, WRONG_QUALITY_PENALTY);
    batch.quality -= qualityPenalty;
  }

  const actionSeconds = correct ? CORRECT_ACTION_SECONDS : WRONG_ACTION_SECONDS;
  state = advanceTime(state, actionSeconds, data);
  if (completedBatch && state.status === 'playing') spawnReplacement(state, data);

  const event = {
    elapsed: state.elapsed,
    instanceId,
    batchId: definition.id,
    stationId,
    expectedStationId: expected,
    correct,
    stepScore,
    completionScore,
    qualityPenalty,
    completedBatch,
    combo: state.combo,
    score: state.score,
    timeRemaining: state.timeRemaining
  };
  state.lastAction = event;
  appendHistory(state, event);
  return state;
}

export function shiftRank(state) {
  if (!state || state.completed <= 0) return 'Rookie';
  const efficiency = state.score - state.mistakes * 50;
  if (state.completed >= 10 && efficiency >= 1800) return 'Room Captain';
  if (state.completed >= 7 && efficiency >= 1100) return 'Trim Ace';
  if (state.completed >= 4 && efficiency >= 600) return 'Shift Pro';
  return 'Hustler';
}
