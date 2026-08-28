import { fetchJson } from './_runtime/src/data/fetch-json.js';
import { summarizeMvpData, showPanel } from './_runtime/src/ui/render-summary.js';
import { renderChosenStarter, renderStarterSelection } from './_runtime/src/ui/starter-selection-ui.js';
import { renderMapGrid, renderMapLabel } from './_runtime/src/ui/map-ui.js';
import { renderMovementControls } from './_runtime/src/ui/movement-ui.js';
import { bindInteractionButton, renderInteractionControls, renderInteractionResult, renderNearbyInteractionHint } from './_runtime/src/ui/interaction-ui.js';
import { renderDialogueBox } from './_runtime/src/ui/dialogue-box-ui.js';
import { renderEncounterControls, renderEncounterResult } from './_runtime/src/ui/encounter-ui.js';
import { renderCombatPanel, renderCombatResult } from './_runtime/src/ui/combat-ui.js';
import { renderRecipeMessage, renderRecipePanel } from './_runtime/src/ui/recipe-ui.js';
import { renderCollectionPanel } from './_runtime/src/ui/collection-ui.js';
import { renderVaultGardenPanel } from './_runtime/src/ui/vault-garden-ui.js';
import { renderWeatherPanel } from './_runtime/src/ui/weather-ui.js';
import { renderBreedingPanel } from './_runtime/src/ui/breeding-ui.js';
import { renderQuestPanel } from './_runtime/src/ui/quest-ui.js';
import { renderInventoryPanel } from './_runtime/src/ui/inventory-ui.js';
import { renderPhenoLogPanel } from './_runtime/src/ui/phenolog-ui.js';
import { renderLineageLabPanel } from './_runtime/src/ui/lineage-lab-ui.js';
import { chooseStarter, getStarterOptions } from './_runtime/src/engine/starter-selection.js';
import { previewPairing } from './_runtime/src/engine/breeding.js';
import { getLineagePreviews } from './_runtime/src/engine/lineage-lab.js';
import { addStoredUnit, setStarterChoice } from './_runtime/src/engine/game-state.js';
import { loadSave, resetSave, writeSave } from './_runtime/src/engine/save.js';
import { getMap } from './_runtime/src/engine/maps.js';
import { applyTransition, movePlayer } from './_runtime/src/engine/movement.js';
import { resolveInteraction } from './_runtime/src/engine/interactions.js';
import { applyDialogueEffects, advanceDialogueSession, createDialogueSession, selectDialogueChoice } from './_runtime/src/engine/dialogue-runner.js';
import { chooseEnemyAction } from './_runtime/src/engine/combat-ai.js';
import { rollEncounter, rollLevel } from './_runtime/src/engine/encounters.js';
import { findExpression, getExpressionRewardTag } from './_runtime/src/engine/expression.js';
import { createCombatant, isDefeated, resolveAbility } from './_runtime/src/engine/battle.js';
import { calculateMaterialReward } from './_runtime/src/engine/battle-rewards.js';
import { addBattleProgress, addMaterials, addRootedResult, spendMaterials } from './_runtime/src/engine/collection.js';
import { addMaterial, removeMaterial } from './_runtime/src/engine/inventory.js';
import { applyQuestEvent } from './_runtime/src/engine/quest-events.js';
import { tickStatuses } from './_runtime/src/engine/status-effects.js';
import { createTimer } from './_runtime/src/engine/timers.js';
import { addResultTimer, findResultTimer, refreshResultTimers, removeResultTimer } from './_runtime/src/engine/result-timers.js';
import { createTimerResult } from './_runtime/src/engine/result-factory.js';

const startButton = document.querySelector('#start-button');
const resetButton = document.querySelector('#reset-save-button');
const panel = document.querySelector('#game-panel');
const panelTitle = document.querySelector('#panel-title');
const panelCopy = document.querySelector('#panel-copy');
const questPanel = document.querySelector('#quest-panel');
const weatherPanel = document.querySelector('#weather-panel');
const starterSelection = document.querySelector('#starter-selection');
const mapLabel = document.querySelector('#map-label');
const mapPreview = document.querySelector('#map-preview');
const movementControls = document.querySelector('#movement-controls');
const interactionPanel = document.querySelector('#interaction-panel');
const dialoguePanel = document.querySelector('#dialogue-panel');
const encounterControls = document.querySelector('#encounter-controls');
const encounterResult = document.querySelector('#encounter-result');
const combatPanel = document.querySelector('#combat-panel');
const recipePanel = document.querySelector('#recipe-panel');
const inventoryPanel = document.querySelector('#inventory-panel');
const vaultGardenPanel = document.querySelector('#vault-garden-panel');
const breedingPanel = document.querySelector('#breeding-panel');
const lineageLabPanel = document.querySelector('#lineage-lab-panel');
const collectionPanel = document.querySelector('#collection-panel');
const phenoLogPanel = document.querySelector('#phenolog-panel');
const debugOutput = document.querySelector('#debug-output');

let activeData = null;
let activeCombat = null;
let activeDialogueSession = null;
let activeRecipeSpeciesId = null;
let activeRecipeExpressionId = null;
let lastDirection = 'down';

const DATA_PATHS = {
  expressions: './_runtime/data/expressions/expression_matrix_mvp.json',
  starters: './_runtime/data/phenos/mvp_units.json',
  extraUnits: './_runtime/data/phenos/mvp_units_extra.json',
  encounters: './_runtime/data/encounters/terp_fields.json',
  items: './_runtime/data/items/mvp_items.json',
  abilities: './_runtime/data/moves/mvp_abilities.json',
  quests: './_runtime/data/quests/mvp_quests.json',
  dialogue: './_runtime/data/dialogue/mvp_dialogue.json',
  starterSlots: './_runtime/data/starter_slots.json',
  weatherStates: './_runtime/data/weather/weather_states.json',
  genotypeMarkers: './_runtime/data/breeding/genotype_markers.json',
  pairingRules: './_runtime/data/breeding/pairing_rules_mvp.json',
  resultUnits: './_runtime/data/breeding/result_units_mvp.json'
};

const MAP_PATHS = [
  './_runtime/data/maps/seedling_town.json',
  './_runtime/data/maps/greenhouse.json',
  './_runtime/data/maps/terp_fields.json',
  './_runtime/data/maps/aroma_trial_greenhouse.json'
];

async function loadGameData() {
  const entries = await Promise.all(
    Object.entries(DATA_PATHS).map(async ([key, path]) => [key, await fetchJson(path)])
  );
  const maps = await Promise.all(MAP_PATHS.map((path) => fetchJson(path)));
  return { ...Object.fromEntries(entries), maps };
}

function getAllUnits(data) {
  return [...(data.starters ?? []), ...(data.extraUnits ?? [])];
}

function getSpecies(data, speciesId) {
  return getAllUnits(data).find((unit) => unit.id === speciesId) ?? null;
}

function getResultUnit(resultId) {
  return activeData?.resultUnits?.find((unit) => unit.id === resultId) ?? null;
}

function getDisplayNameForSpecies(speciesId) {
  return getSpecies(activeData, speciesId)?.displayName ?? getResultUnit(speciesId)?.displayName ?? speciesId;
}

function getAbility(data, abilityId) {
  return data.abilities.find((ability) => ability.id === abilityId) ?? null;
}

function getUnitActions(data, species) {
  return (species.abilities ?? []).map((abilityId) => getAbility(data, abilityId)).filter(Boolean);
}

function getExpressionById(expressionId) {
  return activeData?.expressions.find((expression) => expression.id === expressionId) ?? null;
}

function renderCurrentMap(data, saveData) {
  const currentMap = getMap(data.maps, saveData.player.currentMap);
  renderMapLabel({ container: mapLabel, map: currentMap, player: saveData.player });
  renderMapGrid({ container: mapPreview, map: currentMap, player: saveData.player });
}

function renderQuestStatus(saveData = loadSave()) {
  renderQuestPanel({ container: questPanel, quests: saveData.quests });
}

function renderWeatherControls(saveData = loadSave()) {
  if (!activeData) return;
  renderWeatherPanel({
    container: weatherPanel,
    weatherStates: activeData.weatherStates ?? [],
    currentWeatherId: saveData.world.weather,
    onSelect: handleWeatherSelect
  });
}

function renderInteractionPanel() {
  renderInteractionControls({ container: interactionPanel, onInteract: handleInteract });
}

function renderNearbyInteractionPanel(saveData = loadSave()) {
  if (!activeData) {
    renderInteractionPanel();
    return;
  }

  const currentMap = getMap(activeData.maps, saveData.player.currentMap);
  const interaction = resolveInteraction({
    map: currentMap,
    saveData,
    direction: saveData.player.facing ?? lastDirection
  });

  renderNearbyInteractionHint({ container: interactionPanel, interaction, onInteract: handleInteract });
}

function renderDialogueSession() {
  renderDialogueBox({
    container: dialoguePanel,
    session: activeDialogueSession,
    onNext: handleDialogueNext,
    onClose: handleDialogueClose,
    onChoice: handleDialogueChoice
  });
}

function renderInventory(saveData = loadSave()) {
  renderInventoryPanel({ container: inventoryPanel, inventory: saveData.inventory });
}

function renderCollectionProgress(saveData = loadSave()) {
  if (!activeData) return;
  renderCollectionPanel({
    container: collectionPanel,
    collection: saveData.collection,
    units: getAllUnits(activeData)
  });
}

function renderPhenoLog(saveData = loadSave()) {
  if (!activeData) return;
  renderPhenoLogPanel({
    container: phenoLogPanel,
    collection: saveData.collection,
    units: getAllUnits(activeData)
  });
}

function renderVaultGarden(saveData = loadSave()) {
  renderVaultGardenPanel({
    container: vaultGardenPanel,
    vaultGarden: saveData.vaultGarden
  });
}

function getPairingCandidates(saveData) {
  const candidateIds = new Set();
  for (const teamUnit of saveData.team ?? []) {
    candidateIds.add(teamUnit.speciesId);
  }
  for (const storedUnit of saveData.vaultGarden?.rootedUnits ?? []) {
    candidateIds.add(storedUnit.speciesId);
  }
  return Array.from(candidateIds);
}

function renderBreedingPreview(saveData = loadSave()) {
  if (!activeData) return;
  const candidates = getPairingCandidates(saveData);
  let selectedPreview = null;
  let selectedParents = [];

  for (let i = 0; i < candidates.length; i += 1) {
    for (let j = i + 1; j < candidates.length; j += 1) {
      const preview = previewPairing({
        rules: activeData.pairingRules ?? [],
        parentA: candidates[i],
        parentB: candidates[j],
        playerState: {
          rank: saveData.player.rank,
          unlockedRegions: saveData.world.unlockedRegions ?? []
        }
      });

      if (preview.reason !== 'no_pairing_rule') {
        selectedPreview = preview;
        selectedParents = [candidates[i], candidates[j]];
        break;
      }
    }
    if (selectedPreview) break;
  }

  renderBreedingPanel({
    container: breedingPanel,
    preview: selectedPreview,
    parentNames: selectedParents.map(getDisplayNameForSpecies),
    resultNames: selectedPreview?.resultPool?.map((resultId) => getResultUnit(resultId)?.displayName ?? resultId) ?? []
  });
}

function renderLineageLab(saveData = loadSave()) {
  if (!activeData) return;
  const previews = getLineagePreviews({
    saveData,
    pairingRules: activeData.pairingRules ?? []
  });

  renderLineageLabPanel({
    container: lineageLabPanel,
    previews,
    getName: getDisplayNameForSpecies
  });
}

function renderPlayerPanels(saveData = loadSave()) {
  renderQuestStatus(saveData);
  renderInventory(saveData);
  renderCollectionProgress(saveData);
  renderPhenoLog(saveData);
  renderVaultGarden(saveData);
  renderBreedingPreview(saveData);
  renderLineageLab(saveData);
}

function renderActiveCombat(log = '') {
  if (!activeCombat) return;
  renderCombatPanel({
    container: combatPanel,
    player: activeCombat.player,
    opponent: activeCombat.opponent,
    actions: activeCombat.actions,
    log,
    onAction: handleCombatAction
  });
}

function tickCombatRoundStatuses() {
  if (!activeCombat) return;
  activeCombat = {
    ...activeCombat,
    player: tickStatuses(activeCombat.player),
    opponent: tickStatuses(activeCombat.opponent)
  };
}

function clearPlayPanels() {
  encounterResult.innerHTML = '';
  combatPanel.innerHTML = '';
  recipePanel.innerHTML = '';
  inventoryPanel.innerHTML = '';
  vaultGardenPanel.innerHTML = '';
  breedingPanel.innerHTML = '';
  lineageLabPanel.innerHTML = '';
  collectionPanel.innerHTML = '';
  phenoLogPanel.innerHTML = '';
  dialoguePanel.innerHTML = '';
  activeCombat = null;
  activeDialogueSession = null;
  activeRecipeSpeciesId = null;
  activeRecipeExpressionId = null;
}

function renderRecipeForSpecies(species, expression = null) {
  if (!species) return;

  const refreshedSave = refreshResultTimers(loadSave());
  writeSave(refreshedSave);

  const entry = refreshedSave.collection[species.id];
  const activeTimer = findResultTimer(refreshedSave, species.id);
  activeRecipeSpeciesId = species.id;
  activeRecipeExpressionId = expression?.id ?? activeRecipeExpressionId;

  renderRecipePanel({
    container: recipePanel,
    entry,
    species,
    activeTimer,
    onStart: () => handleStartRecipe(species, expression),
    onRefresh: () => renderRecipeForSpecies(species, expression),
    onClaim: () => handleClaimRecipe(species)
  });
  renderPlayerPanels(refreshedSave);
}

function handleWeatherSelect(weatherId) {
  const saveData = loadSave();
  const nextSave = {
    ...saveData,
    world: {
      ...saveData.world,
      weather: weatherId
    }
  };

  writeSave(nextSave);
  renderWeatherControls(nextSave);
  panelCopy.textContent = 'Weather updated. Encounter rolls and timer result expressions now use the selected weather.';
  debugOutput.textContent = JSON.stringify({ weather: nextSave.world.weather, cue: nextSave.world.cue }, null, 2);
}

function handleStartRecipe(species, expression = null) {
  const saveData = refreshResultTimers(loadSave());
  const entry = saveData.collection[species.id];
  if (!entry || entry.materialsOwned < entry.materialsRequired) return;

  const timer = createTimer({
    id: `${species.id}_${Date.now()}`,
    recipeId: species.id,
    durationSeconds: species.recipe.demoSeconds,
    inputTags: [getExpressionRewardTag(expression)],
    weatherAtStart: saveData.world.weather,
    cueAtStart: saveData.world.cue
  });

  const nextSave = addResultTimer({
    ...saveData,
    collection: spendMaterials(saveData.collection, species.id, entry.materialsRequired),
    inventory: removeMaterial(saveData.inventory, species.id, entry.materialsRequired)
  }, timer);

  writeSave(nextSave);
  renderRecipeForSpecies(species, expression);
  renderPlayerPanels(nextSave);
  debugOutput.textContent = JSON.stringify({ timerStarted: timer, activeQuest: nextSave.quests.activeQuest }, null, 2);
}

function handleClaimRecipe(species) {
  const saveData = refreshResultTimers(loadSave());
  const timer = findResultTimer(saveData, species.id);
  if (!timer || timer.status !== 'ready') return;

  const expression = getExpressionById(activeRecipeExpressionId) ?? findExpression(activeData.expressions, timer.weatherAtStart, timer.cueAtStart);
  const resultUnit = createTimerResult({ species, expression, sourceTags: timer.inputTags });
  const withoutTimer = removeResultTimer(saveData, timer.id);
  const withStoredUnit = addStoredUnit(withoutTimer, resultUnit);
  const withCollection = {
    ...withStoredUnit,
    collection: addRootedResult(withStoredUnit.collection, species.id, resultUnit.trait, resultUnit.expression, resultUnit.isKeeper)
  };
  const nextSave = applyQuestEvent(withCollection, 'first_result_claimed');

  writeSave(nextSave);
  renderRecipeMessage({ container: recipePanel, message: `${resultUnit.displayName} result claimed and saved to the Vault Garden.` });
  renderPlayerPanels(nextSave);
  debugOutput.textContent = JSON.stringify({ resultUnit, activeQuest: nextSave.quests.activeQuest, collection: nextSave.collection[species.id] }, null, 2);
}

function handleMove(direction) {
  if (!activeData) return;

  lastDirection = direction;
  const saveData = loadSave();
  const currentMap = getMap(activeData.maps, saveData.player.currentMap);
  const moveResult = movePlayer(saveData, currentMap, direction);
  let nextSave = {
    ...moveResult.saveData,
    player: {
      ...moveResult.saveData.player,
      facing: direction
    }
  };

  if (moveResult.transition) {
    nextSave = applyTransition(nextSave, moveResult.transition);
  }

  writeSave(nextSave);
  renderCurrentMap(activeData, nextSave);
  renderNearbyInteractionPanel(nextSave);
  debugOutput.textContent = JSON.stringify({
    map: nextSave.player.currentMap,
    position: nextSave.player.position,
    facing: nextSave.player.facing,
    weather: nextSave.world.weather,
    cue: nextSave.world.cue,
    moved: moveResult.moved,
    transition: moveResult.transition?.id ?? null
  }, null, 2);
}

function handleInteract() {
  if (!activeData) return;

  const saveData = loadSave();
  const currentMap = getMap(activeData.maps, saveData.player.currentMap);
  const interaction = resolveInteraction({ map: currentMap, saveData, direction: saveData.player.facing ?? lastDirection });

  renderInteractionResult({ container: interactionPanel, interaction });
  bindInteractionButton({ container: interactionPanel, onInteract: handleInteract });

  if (!interaction.dialogueId) {
    activeDialogueSession = null;
    dialoguePanel.innerHTML = '';
    debugOutput.textContent = JSON.stringify({ interaction }, null, 2);
    return;
  }

  activeDialogueSession = createDialogueSession(activeData.dialogue, interaction.dialogueId, saveData);
  if (activeDialogueSession.active) {
    const nextSave = applyDialogueEffects(saveData, activeDialogueSession.record);
    writeSave(nextSave);
    renderPlayerPanels(nextSave);
    renderDialogueSession();
  }

  debugOutput.textContent = JSON.stringify({ interaction, dialogue: activeDialogueSession.reason }, null, 2);
}

function handleDialogueNext() {
  if (!activeData || !activeDialogueSession) return;

  activeDialogueSession = advanceDialogueSession(activeDialogueSession, activeData.dialogue);
  if (!activeDialogueSession.active) {
    handleDialogueClose();
    return;
  }

  const saveData = loadSave();
  const nextSave = applyDialogueEffects(saveData, activeDialogueSession.record);
  writeSave(nextSave);
  renderPlayerPanels(nextSave);
  renderDialogueSession();
}

function handleDialogueChoice(choiceId) {
  if (!activeData || !activeDialogueSession) return;

  const selection = selectDialogueChoice(activeDialogueSession, activeData.dialogue, choiceId);
  if (!selection.choice) return;

  const saveData = loadSave();
  const nextSave = applyDialogueEffects(saveData, selection.choice);
  writeSave(nextSave);
  activeDialogueSession = selection.session;
  renderPlayerPanels(nextSave);
  renderDialogueSession();
  debugOutput.textContent = JSON.stringify({ choice: selection.choice.id, dialogue: activeDialogueSession.reason }, null, 2);
}

function handleDialogueClose() {
  activeDialogueSession = null;
  dialoguePanel.innerHTML = '';
  renderNearbyInteractionPanel(loadSave());
}

function handleEncounterRoll() {
  if (!activeData) return;

  const saveData = loadSave();
  const state = {
    weather: saveData.world.weather,
    cue: saveData.world.cue,
    flags: saveData.quests.flags
  };
  const encounter = rollEncounter(activeData.encounters, state);
  const species = encounter ? getSpecies(activeData, encounter.speciesId) : null;
  const level = encounter ? rollLevel(encounter) : null;
  const expression = findExpression(activeData.expressions, state.weather, state.cue);

  renderEncounterResult({ container: encounterResult, encounter, species, level, expression });

  if (species && saveData.team[0]) {
    const playerSpecies = getSpecies(activeData, saveData.team[0].speciesId);
    activeCombat = {
      species,
      expression,
      player: createCombatant(playerSpecies, saveData.team[0].level ?? 1),
      opponent: createCombatant(species, level),
      actions: getUnitActions(activeData, playerSpecies),
      opponentActions: getUnitActions(activeData, species)
    };
    renderActiveCombat('Combat test started. Choose an action.');
  }

  debugOutput.textContent = JSON.stringify({
    encounter: encounter?.speciesId ?? null,
    level,
    weather: state.weather,
    cue: state.cue,
    expression: expression?.id ?? null
  }, null, 2);
}

function awardVictory(activeCombatState) {
  const saveData = loadSave();
  const tag = getExpressionRewardTag(activeCombatState.expression);
  const reward = calculateMaterialReward({
    victory: true,
    highStability: activeCombatState.player.stability >= 7,
    expressionTag: tag
  });

  const collectionAfterBattle = addBattleProgress(saveData.collection, activeCombatState.species);
  const collectionAfterReward = addMaterials(collectionAfterBattle, activeCombatState.species, reward.materialCount, activeCombatState.expression?.id ?? null);
  const inventoryAfterReward = addMaterial(saveData.inventory, activeCombatState.species.id, reward.materialCount, reward.tags);
  const withReward = {
    ...saveData,
    collection: collectionAfterReward,
    inventory: inventoryAfterReward
  };
  const withFirstBattle = applyQuestEvent(withReward, 'first_battle_won');
  const nextSave = applyQuestEvent(withFirstBattle, 'first_material_earned');

  writeSave(nextSave);
  return { reward, nextSave };
}

function handleCombatAction(actionId) {
  if (!activeCombat || !activeData) return;

  const action = getAbility(activeData, actionId);
  if (!action) return;

  const playerTurn = resolveAbility({ attacker: activeCombat.player, defender: activeCombat.opponent, ability: action });

  activeCombat.player = playerTurn.attacker;
  activeCombat.opponent = playerTurn.defender;

  if (isDefeated(activeCombat.opponent)) {
    const defeatedState = activeCombat;
    const { reward, nextSave } = awardVictory(defeatedState);
    renderCombatResult({ container: combatPanel, message: `${defeatedState.opponent.displayName} was defeated. Earned ${reward.materialCount} field material.` });
    renderRecipeForSpecies(defeatedState.species, defeatedState.expression);
    renderPlayerPanels(nextSave);
    debugOutput.textContent = JSON.stringify({ reward, activeQuest: nextSave.quests.activeQuest, collection: nextSave.collection[defeatedState.species.id] }, null, 2);
    activeCombat = null;
    return;
  }

  const opponentAction = chooseEnemyAction({
    opponent: activeCombat.opponent,
    player: activeCombat.player,
    actions: activeCombat.opponentActions
  });

  if (!opponentAction) {
    tickCombatRoundStatuses();
    renderActiveCombat(playerTurn.log);
    return;
  }

  const opponentTurn = resolveAbility({ attacker: activeCombat.opponent, defender: activeCombat.player, ability: opponentAction });

  activeCombat.opponent = opponentTurn.attacker;
  activeCombat.player = opponentTurn.defender;

  if (isDefeated(activeCombat.player)) {
    renderCombatResult({ container: combatPanel, message: `${activeCombat.player.displayName} cannot continue. Reset or try another encounter.` });
    activeCombat = null;
    return;
  }

  tickCombatRoundStatuses();
  renderActiveCombat(`${playerTurn.log}\n${opponentTurn.log}\nStatus durations ticked down.`);
}

function handleResetSave() {
  const freshSave = resetSave();
  clearPlayPanels();
  if (activeData) {
    renderWeatherControls(freshSave);
    renderCurrentMap(activeData, freshSave);
    renderNearbyInteractionPanel(freshSave);
    renderPlayerPanels(freshSave);
  }
  starterSelection.innerHTML = '';
  panelCopy.textContent = 'Save reset. Press Start Demo again or choose a new starter.';
  debugOutput.textContent = JSON.stringify(freshSave.player, null, 2);
}

function bindKeyboardMovement() {
  window.addEventListener('keydown', (event) => {
    const keyMap = { ArrowUp: 'up', ArrowDown: 'down', ArrowLeft: 'left', ArrowRight: 'right', w: 'up', s: 'down', a: 'left', d: 'right' };
    const direction = keyMap[event.key];
    if (direction) {
      event.preventDefault();
      handleMove(direction);
      return;
    }

    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      if (activeDialogueSession?.active) handleDialogueNext();
      else handleInteract();
    }
  });
}

bindKeyboardMovement();
resetButton?.addEventListener('click', handleResetSave);

startButton?.addEventListener('click', async () => {
  showPanel({ panel, titleEl: panelTitle, copyEl: panelCopy, debugEl: debugOutput, title: 'Seedling Town Demo', copy: 'Loading MVP data...' });

  try {
    const data = await loadGameData();
    activeData = data;
    const allUnits = getAllUnits(data);
    const starters = getStarterOptions(allUnits);
    const currentSave = loadSave();

    showPanel({
      panel,
      titleEl: panelTitle,
      copyEl: panelCopy,
      debugEl: debugOutput,
      title: 'Choose Your First Partner',
      copy: 'Pick one starter to begin the Seedling Town Demo. Weather can be changed for testing encounters and expressions.',
      debug: summarizeMvpData(data)
    });

    renderWeatherControls(currentSave);
    renderMovementControls({ container: movementControls, onMove: handleMove });
    renderNearbyInteractionPanel(currentSave);
    renderEncounterControls({ container: encounterControls, onRoll: handleEncounterRoll });
    renderPlayerPanels(currentSave);

    renderStarterSelection({
      container: starterSelection,
      starters,
      onChoose: (starterId) => {
        const starterUnit = chooseStarter(allUnits, starterId);
        const withStarter = setStarterChoice(loadSave(), starterId, starterUnit);
        const nextSave = applyQuestEvent(withStarter, 'starter_chosen');
        writeSave(nextSave);

        renderChosenStarter({ container: starterSelection, starterUnit });
        renderWeatherControls(nextSave);
        renderCurrentMap(data, nextSave);
        renderNearbyInteractionPanel(nextSave);
        renderPlayerPanels(nextSave);
        panelCopy.textContent = 'Starter saved locally. Move, interact with NPCs, change weather, roll encounters, win combat, start a timer, and claim the result.';
        debugOutput.textContent = JSON.stringify({ player: nextSave.player, weather: nextSave.world.weather, activeQuest: nextSave.quests.activeQuest }, null, 2);
      }
    });
  } catch (error) {
    showPanel({ panel, titleEl: panelTitle, copyEl: panelCopy, debugEl: debugOutput, title: 'Data Load Error', copy: 'Data load failed. Check paths and JSON files.', debug: String(error) });
  }
});
