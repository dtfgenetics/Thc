export const RUN_CODE_LENGTH = 6;
export const RUN_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
export const PHENOTYPES_PER_CROSS = 3;

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
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
  if (!Array.isArray(data?.traits) || !Array.isArray(data?.cards) || !Array.isArray(data?.goals)) {
    throw new Error('Pheno Draft card data is required.');
  }
  if (!Number.isInteger(data.rounds) || data.rounds < 1 || !Number.isInteger(data.refreshTokens)) {
    throw new Error('Pheno Draft run settings are invalid.');
  }
}

function cardMap(data) {
  return new Map(data.cards.map((card) => [card.id, card]));
}

function goalMap(data) {
  return new Map(data.goals.map((goal) => [goal.id, goal]));
}

export function normalizeRunCode(value) {
  const allowed = new Set(RUN_ALPHABET);
  return String(value ?? '')
    .trim()
    .toUpperCase()
    .split('')
    .filter((character) => allowed.has(character))
    .join('')
    .slice(0, RUN_CODE_LENGTH);
}

export function isValidRunCode(value) {
  return normalizeRunCode(value).length === RUN_CODE_LENGTH;
}

export function goalFit(line, goal, data) {
  requireData(data);
  if (!line?.traits || !goal?.weights) return 0;
  let weighted = 0;
  let weightTotal = 0;
  for (const trait of data.traits) {
    const weight = Number(goal.weights[trait.id] ?? 0);
    if (weight <= 0) continue;
    weighted += Number(line.traits[trait.id] ?? 0) * weight;
    weightTotal += 10 * weight;
  }
  if (!weightTotal) return 0;
  return Math.round((weighted / weightTotal) * 100);
}

function baseLine(card) {
  return {
    lineId: `founder-${card.id}`,
    label: card.label,
    family: card.family,
    hue: card.hue,
    generation: 0,
    traits: clone(card.traits),
    sourceCardIds: [card.id]
  };
}

function deterministicOrder(code, key, data) {
  const length = data.cards.length;
  const start = hash(`${code}:${key}:start`) % length;
  const order = [];
  for (let offset = 0; offset < length; offset += 1) {
    order.push(data.cards[(start + offset) % length]);
  }
  return order;
}

function offerIdsForState(state, data, { blockCurrent = false } = {}) {
  const blocked = new Set(state.usedParentIds);
  for (const sourceId of state.currentLine.sourceCardIds ?? []) blocked.add(sourceId);
  if (blockCurrent) {
    for (const id of state.offers ?? []) blocked.add(id);
  }

  const key = `round:${state.round}:refresh:${state.refreshesUsed}`;
  const order = deterministicOrder(state.code, key, data);
  let choices = order.filter((card) => !blocked.has(card.id)).slice(0, 3);

  if (choices.length < 3 && blockCurrent) {
    const fallbackBlocked = new Set(state.usedParentIds);
    for (const sourceId of state.currentLine.sourceCardIds ?? []) fallbackBlocked.add(sourceId);
    choices = order.filter((card) => !fallbackBlocked.has(card.id)).slice(0, 3);
  }
  if (choices.length < 3) throw new Error('Not enough parent cards remain to create a draft offer.');
  return choices.map((card) => card.id);
}

function phenoName(code, round, parentId, index) {
  const prefixes = ['Nova', 'Velvet', 'Frost', 'Prism', 'Solar', 'Lunar', 'Cobalt', 'Amber'];
  const suffixes = ['Relay', 'Bloom', 'Orbit', 'Signal', 'Drift', 'Current', 'Atlas', 'Circuit'];
  const prefix = prefixes[hash(`${code}:${round}:${parentId}:${index}:prefix`) % prefixes.length];
  const suffix = suffixes[hash(`${code}:${round}:${parentId}:${index}:suffix`) % suffixes.length];
  return `${prefix} ${suffix}`;
}

export function generatePhenotypes(currentLine, parentCard, { code, round }, data) {
  requireData(data);
  if (!currentLine?.traits || !parentCard?.traits) throw new Error('Both parent trait profiles are required.');
  const results = [];

  for (let index = 0; index < PHENOTYPES_PER_CROSS; index += 1) {
    const traits = {};
    for (const trait of data.traits) {
      const left = Number(currentLine.traits[trait.id]);
      const right = Number(parentCard.traits[trait.id]);
      const midpoint = Math.round((left + right) / 2);
      const variance = (hash(`${code}:${round}:${parentCard.id}:${index}:${trait.id}`) % 3) - 1;
      traits[trait.id] = clamp(midpoint + variance, 1, 10);
    }

    const sourceCardIds = [...new Set([...(currentLine.sourceCardIds ?? []), parentCard.id])];
    results.push({
      lineId: `r${round}-${parentCard.id}-${index + 1}`,
      label: phenoName(code, round, parentCard.id, index),
      family: `${currentLine.family} × ${parentCard.family}`,
      hue: Math.round((Number(currentLine.hue) + Number(parentCard.hue)) / 2) % 360,
      generation: round,
      traits,
      sourceCardIds,
      parentCardId: parentCard.id,
      phenotypeIndex: index
    });
  }
  return results;
}

export function createRun({ code } = {}, data) {
  requireData(data);
  const normalized = normalizeRunCode(code);
  if (!isValidRunCode(normalized)) throw new Error('A six-character Pheno Draft run code is required.');

  const founder = data.cards[hash(`${normalized}:founder`) % data.cards.length];
  const goal = data.goals[hash(`${normalized}:goal`) % data.goals.length];
  const line = baseLine(founder);
  const state = {
    schemaVersion: 1,
    code: normalized,
    status: 'playing',
    phase: 'draft',
    round: 1,
    maxRounds: data.rounds,
    goalId: goal.id,
    founderCardId: founder.id,
    currentLine: line,
    currentFit: goalFit(line, goal, data),
    offers: [],
    selectedParentId: null,
    phenotypes: [],
    refreshesRemaining: data.refreshTokens,
    refreshesUsed: 0,
    usedParentIds: [],
    archive: [],
    history: [],
    score: 0,
    finalRank: null
  };
  state.offers = offerIdsForState(state, data);
  return state;
}

export function refreshDraft(inputState, data) {
  requireData(data);
  const state = clone(inputState);
  if (state.status !== 'playing' || state.phase !== 'draft') throw new Error('Draft refresh is only available during the draft phase.');
  if (state.refreshesRemaining <= 0) throw new Error('No draft refresh tokens remain.');
  const previous = [...state.offers];
  state.refreshesRemaining -= 1;
  state.refreshesUsed += 1;
  state.offers = offerIdsForState({ ...state, offers: previous }, data, { blockCurrent: true });
  state.history.push({ type: 'refresh', round: state.round, offers: [...state.offers] });
  return state;
}

export function selectParent(inputState, parentId, data) {
  requireData(data);
  const state = clone(inputState);
  if (state.status !== 'playing' || state.phase !== 'draft') throw new Error('A parent can only be selected during the draft phase.');
  if (!state.offers.includes(parentId)) throw new Error('That parent card is not in the current draft offer.');
  const parent = cardMap(data).get(parentId);
  if (!parent) throw new Error(`Unknown parent card: ${parentId}`);

  state.selectedParentId = parentId;
  state.phenotypes = generatePhenotypes(state.currentLine, parent, { code: state.code, round: state.round }, data);
  state.phase = 'phenotype';
  state.history.push({ type: 'parent', round: state.round, parentId });
  return state;
}

function rankForState(state, data) {
  const goal = goalMap(data).get(state.goalId);
  const fit = goalFit(state.currentLine, goal, data);
  if (fit >= 88 && state.score >= 4200) return 'Legacy Builder';
  if (fit >= 82 && state.score >= 3400) return 'Draft Architect';
  if (fit >= 76 && state.score >= 2700) return 'Selection Specialist';
  if (fit >= 68) return 'Keeper Hunter';
  return 'Foundation Scout';
}

export function selectPhenotype(inputState, lineId, data) {
  requireData(data);
  const state = clone(inputState);
  if (state.status !== 'playing' || state.phase !== 'phenotype') throw new Error('A phenotype can only be kept after a parent is selected.');
  const selected = state.phenotypes.find((line) => line.lineId === lineId);
  if (!selected) throw new Error('That phenotype is not available in the current cross.');

  const goal = goalMap(data).get(state.goalId);
  if (!goal) throw new Error(`Unknown goal: ${state.goalId}`);
  const previousFit = goalFit(state.currentLine, goal, data);
  const nextFit = goalFit(selected, goal, data);
  const improvement = nextFit - previousFit;
  const roundScore = Math.max(0, Math.round((nextFit * 8) + (improvement * 15)));

  state.currentLine = clone(selected);
  state.currentFit = nextFit;
  state.score += roundScore;
  if (!state.usedParentIds.includes(state.selectedParentId)) state.usedParentIds.push(state.selectedParentId);
  state.archive.push({
    round: state.round,
    parentId: state.selectedParentId,
    line: clone(selected),
    fit: nextFit,
    improvement,
    roundScore
  });
  state.history.push({
    type: 'keep',
    round: state.round,
    parentId: state.selectedParentId,
    lineId: selected.lineId,
    fit: nextFit,
    improvement,
    roundScore
  });

  if (state.round >= state.maxRounds) {
    state.score += (nextFit * 10) + (state.refreshesRemaining * 75);
    state.status = 'complete';
    state.phase = 'complete';
    state.selectedParentId = null;
    state.phenotypes = [];
    state.offers = [];
    state.finalRank = rankForState(state, data);
    return state;
  }

  state.round += 1;
  state.phase = 'draft';
  state.selectedParentId = null;
  state.phenotypes = [];
  state.offers = offerIdsForState(state, data);
  return state;
}

export function runRank(state, data) {
  requireData(data);
  return state.finalRank ?? rankForState(state, data);
}
