import { createScreenState, pushScreen } from './screens.js';

export function createGameController({ data, saveData }) {
  return {
    data,
    saveData,
    screen: createScreenState(),
    activeCombat: null,
    activeRecipeSpeciesId: null,
    activeRecipeExpressionId: null
  };
}

export function setControllerSave(controller, saveData) {
  return {
    ...controller,
    saveData
  };
}

export function setControllerScreen(controller, screenId) {
  return {
    ...controller,
    screen: pushScreen(controller.screen, screenId)
  };
}

export function setActiveCombat(controller, activeCombat) {
  return {
    ...controller,
    activeCombat
  };
}

export function clearActiveCombat(controller) {
  return setActiveCombat(controller, null);
}

export function setActiveRecipe(controller, { speciesId = null, expressionId = null } = {}) {
  return {
    ...controller,
    activeRecipeSpeciesId: speciesId,
    activeRecipeExpressionId: expressionId
  };
}
