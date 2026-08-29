export const TRIAL_CODE_LENGTH = 6;
export const TRIAL_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
export const SCORE_MIN = 1;
export const SCORE_MAX = 10;

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
  if (!data?.categories?.length || !data?.entries?.length || !Number.isInteger(data?.roundsPerRun)) {
    throw new Error('Trichome Trials data is required.');
  }
  if (data.roundsPerRun > data.entries.length) throw new Error('roundsPerRun exceeds available entries.');
}

function entryMap(data) {
  return new Map(data.entries.map((entry) => [entry.id, entry]));
}

export function normalizeTrialCode(value) {
  const allowed = new Set(TRIAL_ALPHABET);
  return String(value ?? '')
    .trim()
    .toUpperCase()
    .split('')
    .filter((character) => allowed.has(character))
    .join('')
    .slice(0, TRIAL_CODE_LENGTH);
}

export function isValidTrialCode(value) {
  return normalizeTrialCode(value).length === TRIAL_CODE_LENGTH;
}

export function trialEntryOrder(code, data) {
  requireData(data);
  const normalized = normalizeTrialCode(code);
  if (!isValidTrialCode(normalized)) throw new Error('A six-character trial code is required.');
  return data.entries
    .map((entry) => ({ id: entry.id, seed: hash(`${normalized}:${entry.id}`) }))
    .sort((a, b) => a.seed - b.seed || a.id.localeCompare(b.id))
    .slice(0, data.roundsPerRun)
    .map((item) => item.id);
}

export function validateScorecard(scorecard, data) {
  requireData(data);
  if (!scorecard || typeof scorecard !== 'object') throw new Error('A complete scorecard is required.');
  const clean = {};
  for (const category of data.categories) {
    const value = Number(scorecard[category.id]);
    if (!Number.isInteger(value) || value < SCORE_MIN || value > SCORE_MAX) {
      throw new Error(`${category.label} must be an integer from ${SCORE_MIN} to ${SCORE_MAX}.`);
    }
    clean[category.id] = value;
  }
  return clean;
}

export function scoreScorecard(scorecard, benchmark, data) {
  const clean = validateScorecard(scorecard, data);
  let totalError = 0;
  let exactCount = 0;
  let nearCount = 0;
  const categories = {};

  for (const category of data.categories) {
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

  const maxError = data.categories.length * (SCORE_MAX - SCORE_MIN);
  const accuracy = Math.max(0, Math.round((1 - totalError / maxError) * 100));
  const points = accuracy + exactCount * 4 + nearCount * 2;
  return { scorecard: clean, totalError, accuracy, exactCount, nearCount, points, categories };
}

export function createTrial({ code } = {}, data) {
  requireData(data);
  const normalized = normalizeTrialCode(code);
  if (!isValidTrialCode(normalized)) throw new Error('A six-character trial code is required.');
  const entryOrder = trialEntryOrder(normalized, data);
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

export function submitScorecard(inputState, scorecard, data) {
  requireData(data);
  const state = clone(inputState);
  if (state.status !== 'judging') throw new Error('This trial is not accepting a scorecard.');
  const entry = entryMap(data).get(state.currentEntryId);
  if (!entry) throw new Error(`Unknown current trial entry: ${state.currentEntryId}`);

  const scored = scoreScorecard(scorecard, entry.scores, data);
  const result = {
    round: state.round,
    entryId: entry.id,
    accuracy: scored.accuracy,
    points: scored.points,
    exactCount: scored.exactCount,
    nearCount: scored.nearCount,
    totalError: scored.totalError,
    categories: scored.categories
  };

  state.totalPoints += scored.points;
  state.accuracyTotal += scored.accuracy;
  state.exactCalls += scored.exactCount;
  state.nearCalls += scored.nearCount;
  state.lastResult = result;
  state.history.push(result);
  state.status = 'review';
  return state;
}

export function advanceTrial(inputState, data) {
  requireData(data);
  const state = clone(inputState);
  if (state.status !== 'review') throw new Error('Review the current scorecard before advancing.');
  if (state.round >= state.roundsTotal) {
    state.status = 'complete';
    state.currentEntryId = null;
    return state;
  }
  state.round += 1;
  state.currentEntryId = state.entryOrder[state.round - 1];
  state.lastResult = null;
  state.status = 'judging';
  return state;
}

export function averageAccuracy(state) {
  if (!state?.history?.length) return 0;
  return Math.round(state.accuracyTotal / state.history.length);
}

export function judgeRank(state) {
  const average = averageAccuracy(state);
  const exact = state?.exactCalls ?? 0;
  if (average >= 95 && exact >= 20) return 'Head Judge';
  if (average >= 88 && exact >= 12) return 'Senior Judge';
  if (average >= 78) return 'Trial Judge';
  if (average >= 65) return 'Scorekeeper';
  return 'Judge in Training';
}
