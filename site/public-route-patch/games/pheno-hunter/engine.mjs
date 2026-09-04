export const HUNTER_CODE_LENGTH = 6;
export const HUNTER_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
export const COHORT_SIZE = 8;
export const OBSERVATION_BUDGET = 10;
export const SHORTLIST_LIMIT = 3;

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

export function normalizeHunterCode(value) {
  const allowed = new Set(HUNTER_ALPHABET);
  return String(value ?? '')
    .trim()
    .toUpperCase()
    .split('')
    .filter((character) => allowed.has(character))
    .join('')
    .slice(0, HUNTER_CODE_LENGTH);
}

export function isValidHunterCode(value) {
  return normalizeHunterCode(value).length === HUNTER_CODE_LENGTH;
}

function requireData(data) {
  if (!data?.briefs?.length || !data?.candidates?.length || !data?.hiddenTraits?.length || !data?.visibleTraits?.length) {
    throw new Error('Pheno Hunter data is required.');
  }
}

function candidateMap(data) {
  return new Map(data.candidates.map((candidate) => [candidate.id, candidate]));
}

function briefMap(data) {
  return new Map(data.briefs.map((brief) => [brief.id, brief]));
}

export function candidateFit(candidate, brief) {
  if (!candidate?.traits || !brief?.weights) throw new Error('Candidate and brief are required for fit scoring.');
  const weighted = Object.entries(brief.weights)
    .reduce((sum, [traitId, weight]) => sum + Number(candidate.traits[traitId] ?? 0) * Number(weight), 0);
  return Math.round(weighted / 10);
}

export function topCandidates(state, data) {
  requireData(data);
  const candidates = candidateMap(data);
  const brief = briefMap(data).get(state.briefId);
  if (!brief) throw new Error(`Unknown brief: ${state.briefId}`);
  return state.cohortIds
    .map((id) => candidates.get(id))
    .filter(Boolean)
    .map((candidate) => ({ candidateId: candidate.id, fit: candidateFit(candidate, brief) }))
    .sort((a, b) => b.fit - a.fit || a.candidateId.localeCompare(b.candidateId));
}

export function createHunt({ code } = {}, data) {
  requireData(data);
  const normalized = normalizeHunterCode(code);
  if (!isValidHunterCode(normalized)) throw new Error('A six-character Pheno Hunter code is required.');
  if (data.candidates.length < COHORT_SIZE) throw new Error(`At least ${COHORT_SIZE} candidates are required.`);

  const brief = data.briefs[hash(`${normalized}:brief`) % data.briefs.length];
  const cohortIds = shuffled(data.candidates.map((candidate) => candidate.id), `${normalized}:cohort`).slice(0, COHORT_SIZE);

  return {
    schemaVersion: 1,
    code: normalized,
    status: 'scouting',
    briefId: brief.id,
    cohortIds,
    observationBudget: OBSERVATION_BUDGET,
    observations: [],
    shortlisted: [],
    result: null
  };
}

export function observationKey(candidateId, traitId) {
  return `${candidateId}:${traitId}`;
}

export function isObserved(state, candidateId, traitId) {
  return state.observations.includes(observationKey(candidateId, traitId));
}

export function observe(inputState, { candidateId, traitId } = {}, data) {
  requireData(data);
  const state = clone(inputState);
  if (state.status !== 'scouting') throw new Error('This hunt is already complete.');
  if (!state.cohortIds.includes(candidateId)) throw new Error(`Candidate is not in this cohort: ${candidateId}`);
  if (!data.hiddenTraits.includes(traitId)) throw new Error(`Trait is not a scoutable hidden trait: ${traitId}`);

  const key = observationKey(candidateId, traitId);
  if (state.observations.includes(key)) return state;
  if (state.observationBudget <= 0) throw new Error('No scouting tokens remain.');

  state.observations.push(key);
  state.observationBudget -= 1;
  return state;
}

export function toggleShortlist(inputState, candidateId, data) {
  requireData(data);
  const state = clone(inputState);
  if (state.status !== 'scouting') throw new Error('This hunt is already complete.');
  if (!state.cohortIds.includes(candidateId)) throw new Error(`Candidate is not in this cohort: ${candidateId}`);

  const index = state.shortlisted.indexOf(candidateId);
  if (index >= 0) {
    state.shortlisted.splice(index, 1);
    return state;
  }
  if (state.shortlisted.length >= SHORTLIST_LIMIT) throw new Error(`Shortlist limit is ${SHORTLIST_LIMIT}.`);
  state.shortlisted.push(candidateId);
  return state;
}

function evidenceScore(state, candidateId, data) {
  const observed = data.hiddenTraits.filter((traitId) => isObserved(state, candidateId, traitId)).length;
  return Math.round((observed / data.hiddenTraits.length) * 20);
}

function comparisonScore(state) {
  const observedCandidates = new Set(state.observations.map((key) => key.split(':')[0])).size;
  if (observedCandidates >= 3) return 10;
  if (observedCandidates === 2) return 6;
  if (observedCandidates === 1) return 3;
  return 0;
}

export function finalizeKeeper(inputState, candidateId, data) {
  requireData(data);
  const state = clone(inputState);
  if (state.status !== 'scouting') throw new Error('This hunt is already complete.');
  if (!state.shortlisted.includes(candidateId)) throw new Error('The final keeper must be on the shortlist.');

  const candidates = candidateMap(data);
  const brief = briefMap(data).get(state.briefId);
  const candidate = candidates.get(candidateId);
  if (!candidate || !brief) throw new Error('Keeper scoring data is unavailable.');

  const ranking = topCandidates(state, data);
  const best = ranking[0];
  const selectedFit = candidateFit(candidate, brief);
  const quality = best.fit > 0 ? Math.round(70 * (selectedFit / best.fit)) : 0;
  const evidence = evidenceScore(state, candidateId, data);
  const comparison = comparisonScore(state);
  const score = Math.min(100, quality + evidence + comparison);

  state.status = 'complete';
  state.result = {
    selectedCandidateId: candidateId,
    selectedFit,
    bestCandidateId: best.candidateId,
    bestFit: best.fit,
    fitGap: Math.max(0, best.fit - selectedFit),
    qualityScore: quality,
    evidenceScore: evidence,
    comparisonScore: comparison,
    score,
    rank: hunterRank(score)
  };
  return state;
}

export function hunterRank(score) {
  if (score >= 96) return 'Elite Scout';
  if (score >= 88) return 'Keeper Hunter';
  if (score >= 78) return 'Sharp Eye';
  if (score >= 65) return 'Field Scout';
  return 'Needs More Notes';
}
