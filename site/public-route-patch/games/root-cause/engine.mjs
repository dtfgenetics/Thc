export const ROOT_CODE_LENGTH = 6;
export const ROOT_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
export const RUN_ROUNDS = 6;
export const MAX_INSPECTIONS = 2;
export const MAX_GUESSES = 2;

const clone = (value) => JSON.parse(JSON.stringify(value));

function hash(value) {
  let result = 2166136261;
  for (const character of String(value)) {
    result ^= character.charCodeAt(0);
    result = Math.imul(result, 16777619);
  }
  return result >>> 0;
}

function shuffled(items, seed) {
  const output = [...items];
  for (let index = output.length - 1; index > 0; index -= 1) {
    const target = hash(`${seed}:${index}`) % (index + 1);
    [output[index], output[target]] = [output[target], output[index]];
  }
  return output;
}

export function normalizeRootCode(value) {
  const allowed = new Set(ROOT_ALPHABET);
  return String(value ?? '')
    .trim()
    .toUpperCase()
    .split('')
    .filter((character) => allowed.has(character))
    .join('')
    .slice(0, ROOT_CODE_LENGTH);
}

export function isValidRootCode(value) {
  return normalizeRootCode(value).length === ROOT_CODE_LENGTH;
}

function requireData(data) {
  if (!data?.cases?.length || !data?.diagnoses?.length) throw new Error('Root Cause data is required.');
}

function getCase(data, id) {
  const found = data.cases.find((item) => item.id === id);
  if (!found) throw new Error(`Unknown case: ${id}`);
  return found;
}

function roundView(caseData, code, roundIndex) {
  const diagnoses = shuffled([caseData.diagnosisId, ...caseData.distractorIds], `${code}:${roundIndex}:diagnoses`);
  const inspections = shuffled(caseData.inspections.map((item) => item.id), `${code}:${roundIndex}:inspections`);
  return { caseId: caseData.id, diagnoses, inspections };
}

export function createRun({ code } = {}, data) {
  requireData(data);
  const normalized = normalizeRootCode(code);
  if (!isValidRootCode(normalized)) throw new Error('A six-character Root Cause code is required.');

  const selected = shuffled(data.cases.map((item) => item.id), `${normalized}:cases`).slice(0, Math.min(RUN_ROUNDS, data.cases.length));
  return {
    schemaVersion: 1,
    code: normalized,
    status: 'playing',
    roundIndex: 0,
    score: 0,
    solved: 0,
    failed: 0,
    caseOrder: selected,
    current: {
      ...roundView(getCase(data, selected[0]), normalized, 0),
      inspectionIds: [],
      guesses: [],
      status: 'active'
    },
    history: []
  };
}

export function currentCase(state, data) {
  requireData(data);
  return getCase(data, state.current.caseId);
}

export function inspect(inputState, inspectionId, data) {
  requireData(data);
  const state = clone(inputState);
  if (state.status !== 'playing' || state.current.status !== 'active') throw new Error('The current case is not accepting inspections.');
  const caseData = currentCase(state, data);
  const inspection = caseData.inspections.find((item) => item.id === inspectionId);
  if (!inspection || !state.current.inspections.includes(inspectionId)) throw new Error(`Unknown inspection: ${inspectionId}`);
  if (state.current.inspectionIds.includes(inspectionId)) return state;
  if (state.current.inspectionIds.length >= MAX_INSPECTIONS) throw new Error('Inspection limit reached.');
  state.current.inspectionIds.push(inspectionId);
  return state;
}

function caseScore(current) {
  const inspectionPenalty = current.inspectionIds.length * 10;
  const guessPenalty = Math.max(0, current.guesses.length - 1) * 25;
  return Math.max(20, 120 - inspectionPenalty - guessPenalty);
}

export function diagnose(inputState, diagnosisId, data) {
  requireData(data);
  const state = clone(inputState);
  if (state.status !== 'playing' || state.current.status !== 'active') throw new Error('The current case is not accepting diagnoses.');
  if (!state.current.diagnoses.includes(diagnosisId)) throw new Error(`Diagnosis is not available: ${diagnosisId}`);
  if (state.current.guesses.includes(diagnosisId)) return state;

  const caseData = currentCase(state, data);
  state.current.guesses.push(diagnosisId);
  const correct = diagnosisId === caseData.diagnosisId;

  if (correct) {
    const earned = caseScore(state.current);
    state.score += earned;
    state.solved += 1;
    state.current.status = 'solved';
    state.current.earned = earned;
  } else if (state.current.guesses.length >= MAX_GUESSES) {
    state.failed += 1;
    state.current.status = 'failed';
    state.current.earned = 0;
  }

  return state;
}

export function advanceCase(inputState, data) {
  requireData(data);
  const state = clone(inputState);
  if (state.status !== 'playing') throw new Error('Run is already complete.');
  if (state.current.status === 'active') throw new Error('Resolve the current case before advancing.');

  const caseData = currentCase(state, data);
  state.history.push({
    caseId: caseData.id,
    diagnosisId: caseData.diagnosisId,
    status: state.current.status,
    inspections: [...state.current.inspectionIds],
    guesses: [...state.current.guesses],
    earned: state.current.earned ?? 0
  });

  const nextIndex = state.roundIndex + 1;
  if (nextIndex >= state.caseOrder.length) {
    state.status = 'complete';
    state.roundIndex = state.caseOrder.length;
    return state;
  }

  state.roundIndex = nextIndex;
  state.current = {
    ...roundView(getCase(data, state.caseOrder[nextIndex]), state.code, nextIndex),
    inspectionIds: [],
    guesses: [],
    status: 'active'
  };
  return state;
}

export function runGrade(state) {
  if (state.status !== 'complete') return null;
  const ratio = state.solved / state.caseOrder.length;
  if (ratio === 1 && state.score >= 600) return 'Root Cause Master';
  if (ratio >= 0.83) return 'Diagnostic Lead';
  if (ratio >= 0.67) return 'Sharp Observer';
  return 'Keep Investigating';
}
