import { submitScorecard } from './engine.mjs';

export const MAX_CONFIDENCE_CALLS = 2;
export const EXACT_CONFIDENCE_BONUS = 6;
export const NEAR_CONFIDENCE_BONUS = 3;

function validateConfidenceIds(confidenceIds, data) {
  if (!Array.isArray(confidenceIds)) throw new Error('Confidence calls must be an array.');
  const unique = [...new Set(confidenceIds)];
  if (unique.length !== confidenceIds.length) throw new Error('Confidence calls must be unique.');
  if (unique.length > MAX_CONFIDENCE_CALLS) throw new Error(`Choose at most ${MAX_CONFIDENCE_CALLS} confidence calls.`);
  const allowed = new Set(data.categories.map((category) => category.id));
  for (const id of unique) {
    if (!allowed.has(id)) throw new Error(`Unknown confidence category: ${id}`);
  }
  return unique;
}

export function confidenceBonusForResult(result, confidenceIds, data) {
  const cleanIds = validateConfidenceIds(confidenceIds, data);
  let bonus = 0;
  const calls = {};
  for (const id of cleanIds) {
    const category = result?.categories?.[id];
    if (!category) throw new Error(`Missing scored category for confidence call: ${id}`);
    const points = category.difference === 0
      ? EXACT_CONFIDENCE_BONUS
      : category.difference === 1
        ? NEAR_CONFIDENCE_BONUS
        : 0;
    calls[id] = { difference: category.difference, bonus: points };
    bonus += points;
  }
  return { bonus, calls, confidenceIds: cleanIds };
}

export function submitConfidentScorecard(inputState, scorecard, confidenceIds, data) {
  const state = submitScorecard(inputState, scorecard, data);
  const confidence = confidenceBonusForResult(state.lastResult, confidenceIds, data);
  state.lastResult.confidenceIds = confidence.confidenceIds;
  state.lastResult.confidenceBonus = confidence.bonus;
  state.lastResult.confidenceCalls = confidence.calls;
  state.lastResult.points += confidence.bonus;
  state.totalPoints += confidence.bonus;
  state.history[state.history.length - 1] = state.lastResult;
  return state;
}
