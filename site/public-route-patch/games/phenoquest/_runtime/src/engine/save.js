import { GAME_CONFIG } from '../game/config.js';
import { migrateSave } from './save-migration.js';
import { safeGetItem, safeSetItem } from './storage.js';

export function createDefaultSave() {
  return {
    version: GAME_CONFIG.version,
    player: {
      name: 'Player',
      rank: 'seedling_runner',
      credits: 0,
      currentMap: GAME_CONFIG.mvp.startMap,
      position: { x: 5, y: 5 },
      starterChoice: null
    },
    team: [],
    vaultGarden: {
      slotsUnlocked: GAME_CONFIG.mvp.cloneSlotsAtStart,
      activeTimers: [],
      lineageTimers: [],
      rootedUnits: [],
      keeperIds: []
    },
    inventory: {
      items: [],
      materials: []
    },
    timers: [],
    collection: {},
    quests: {
      activeQuest: 'choose_your_echo',
      completed: [],
      flags: {}
    },
    world: {
      weather: GAME_CONFIG.mvp.defaultWeather,
      cue: GAME_CONFIG.mvp.defaultCue,
      unlockedRegions: ['seedling_town'],
      regionProgress: {
        terp_fields: 0
      },
      archiveProgress: {
        fruit_branch: 0
      }
    }
  };
}

export function loadSave() {
  const raw = safeGetItem(GAME_CONFIG.storage.saveKey);
  if (!raw) return createDefaultSave();

  try {
    return migrateSave(JSON.parse(raw), createDefaultSave());
  } catch {
    return createDefaultSave();
  }
}

export function writeSave(saveData) {
  safeSetItem(GAME_CONFIG.storage.saveKey, JSON.stringify(saveData));
  return saveData;
}

export function resetSave() {
  const fresh = createDefaultSave();
  writeSave(fresh);
  return fresh;
}
