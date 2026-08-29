export const WHEEL_CODE_LENGTH = 6;
export const WHEEL_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
export const MAX_HISTORY = 12;

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

export function normalizeWheelCode(value) {
  const allowed = new Set(WHEEL_ALPHABET);
  return String(value ?? '')
    .trim()
    .toUpperCase()
    .split('')
    .filter((character) => allowed.has(character))
    .join('')
    .slice(0, WHEEL_CODE_LENGTH);
}

export function isValidWheelCode(value) {
  return normalizeWheelCode(value).length === WHEEL_CODE_LENGTH;
}

export function entriesForMode(data, modeId) {
  return data.entries.filter((entry) => entry.mode === modeId);
}

function requireMode(data, modeId) {
  const mode = data.modes.find((candidate) => candidate.id === modeId);
  if (!mode) throw new Error(`Unknown wheel mode: ${modeId}`);
  const entries = entriesForMode(data, modeId);
  if (entries.length < 2) throw new Error(`Wheel mode ${modeId} needs at least two entries.`);
  return { mode, entries };
}

export function createWheel({ code, mode = 'strain-picker' } = {}, data) {
  if (!data?.modes?.length || !data?.entries?.length) throw new Error('Spin the Strain data is required.');
  const normalized = normalizeWheelCode(code);
  if (!isValidWheelCode(normalized)) throw new Error('A six-character wheel code is required.');
  requireMode(data, mode);
  return {
    schemaVersion: 1,
    code: normalized,
    mode,
    spinCount: 0,
    cycleNumber: 1,
    cycleSeenEntryIds: [],
    lastEntryId: null,
    lastResult: null,
    history: []
  };
}

export function spinWheel(inputState, data) {
  const state = clone(inputState);
  const { entries } = requireMode(data, state.mode);
  const spinNumber = state.spinCount + 1;
  let seen = new Set(state.cycleSeenEntryIds ?? []);

  if (seen.size >= entries.length) {
    state.cycleNumber = Number(state.cycleNumber ?? 1) + 1;
    state.cycleSeenEntryIds = [];
    seen = new Set();
  }

  const unseenEntries = entries.filter((entry) => !seen.has(entry.id));
  if (!unseenEntries.length) throw new Error('Wheel cycle could not find an unseen entry.');
  const cycleNumber = Number(state.cycleNumber ?? 1);
  const unseenIndex = hash(`${state.code}:${state.mode}:cycle:${cycleNumber}:spin:${spinNumber}`) % unseenEntries.length;
  const entry = unseenEntries[unseenIndex];
  const index = entries.findIndex((candidate) => candidate.id === entry.id);
  const cyclePosition = state.cycleSeenEntryIds.length + 1;
  const result = {
    spinNumber,
    index,
    entryId: entry.id,
    label: entry.label,
    detail: entry.detail,
    category: entry.category,
    cycleNumber,
    cyclePosition,
    cycleSize: entries.length
  };

  state.spinCount = spinNumber;
  state.lastEntryId = entry.id;
  state.lastResult = result;
  state.cycleSeenEntryIds.push(entry.id);
  state.history.push(result);
  if (state.history.length > MAX_HISTORY) state.history = state.history.slice(-MAX_HISTORY);
  return state;
}

export function sequence({ code, mode, count = 10 } = {}, data) {
  let state = createWheel({ code, mode }, data);
  const results = [];
  for (let index = 0; index < count; index += 1) {
    state = spinWheel(state, data);
    results.push(state.lastResult.entryId);
  }
  return results;
}
