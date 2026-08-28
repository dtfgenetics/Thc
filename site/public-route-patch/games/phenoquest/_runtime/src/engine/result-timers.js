import { updateAllTimers } from './timers.js';

export function getActiveResultTimers(saveData) {
  return saveData.vaultGarden?.activeTimers ?? [];
}

export function setActiveResultTimers(saveData, timers) {
  return {
    ...saveData,
    vaultGarden: {
      ...saveData.vaultGarden,
      activeTimers: timers
    }
  };
}

export function addResultTimer(saveData, timer) {
  return setActiveResultTimers(saveData, [...getActiveResultTimers(saveData), timer]);
}

export function refreshResultTimers(saveData, now = Date.now()) {
  return setActiveResultTimers(saveData, updateAllTimers(getActiveResultTimers(saveData), now));
}

export function findResultTimer(saveData, recipeId) {
  return getActiveResultTimers(saveData).find((timer) => timer.recipeId === recipeId) ?? null;
}

export function removeResultTimer(saveData, timerId) {
  return setActiveResultTimers(saveData, getActiveResultTimers(saveData).filter((timer) => timer.id !== timerId));
}
