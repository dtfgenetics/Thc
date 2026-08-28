export const SCREEN_IDS = {
  title: 'title',
  starterSelection: 'starter_selection',
  map: 'map',
  encounter: 'encounter',
  combat: 'combat',
  recipe: 'recipe',
  inventory: 'inventory',
  vaultGarden: 'vault_garden',
  phenoLog: 'phenolog',
  lineageLab: 'lineage_lab',
  settings: 'settings',
  debug: 'debug'
};

export function createScreenState(initialScreen = SCREEN_IDS.title) {
  return {
    current: initialScreen,
    history: []
  };
}

export function pushScreen(screenState, nextScreen) {
  return {
    current: nextScreen,
    history: [...(screenState.history ?? []), screenState.current]
  };
}

export function popScreen(screenState) {
  const history = [...(screenState.history ?? [])];
  const previous = history.pop() ?? SCREEN_IDS.title;

  return {
    current: previous,
    history
  };
}

export function isKnownScreen(screenId) {
  return Object.values(SCREEN_IDS).includes(screenId);
}
