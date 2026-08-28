import { createTimer, updateAllTimers } from './timers.js';

export function getActiveLineageTimers(saveData) {
  return saveData.vaultGarden?.lineageTimers ?? [];
}

export function setActiveLineageTimers(saveData, timers) {
  return {
    ...saveData,
    vaultGarden: {
      ...saveData.vaultGarden,
      lineageTimers: timers
    }
  };
}

export function createLineageTimer({ id, pairingRuleId, parentA, parentB, durationSeconds = 60, weatherAtStart = null, cueAtStart = null }) {
  return {
    ...createTimer({
      id,
      recipeId: pairingRuleId,
      durationSeconds,
      inputTags: ['lineage_batch'],
      weatherAtStart,
      cueAtStart
    }),
    type: 'lineage',
    pairingRuleId,
    parentA,
    parentB
  };
}

export function addLineageTimer(saveData, timer) {
  return setActiveLineageTimers(saveData, [...getActiveLineageTimers(saveData), timer]);
}

export function refreshLineageTimers(saveData, now = Date.now()) {
  return setActiveLineageTimers(saveData, updateAllTimers(getActiveLineageTimers(saveData), now));
}

export function findLineageTimer(saveData, timerId) {
  return getActiveLineageTimers(saveData).find((timer) => timer.id === timerId) ?? null;
}

export function removeLineageTimer(saveData, timerId) {
  return setActiveLineageTimers(saveData, getActiveLineageTimers(saveData).filter((timer) => timer.id !== timerId));
}
