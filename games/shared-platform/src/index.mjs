export {
  browserStorage,
  storageGet,
  storageSet,
  storageRemove,
  storageReadJson,
  storageWriteJson,
} from './storage.mjs';

export {
  createSaveEnvelope,
  validateSaveEnvelope,
  migrateSaveEnvelope,
  createVersionedSaveStore,
} from './save.mjs';

export {
  SETTINGS_VERSION,
  DEFAULT_GAME_SETTINGS,
  normalizeGameSettings,
  resolveAccessibilityPreferences,
  applyAccessibilityPreferences,
  createGameSettingsStore,
  effectiveAudioGain,
} from './settings.mjs';

export {
  sanitizeDebugValue,
  validateReplayBundle,
  createReplayRecorder,
  serializeReplayBundle,
  parseReplayBundle,
} from './replay.mjs';

export {
  validateTelemetryEvent,
  createTelemetryBuffer,
  RECOMMENDED_TELEMETRY_EVENTS,
} from './telemetry.mjs';

export {
  DEFAULT_GAME_ACTION_KEYS,
  normalizeActionMap,
  createInputActionMap,
} from './input.mjs';

export {
  DEFAULT_GAMEPAD_BUTTON_MAP,
  DEFAULT_GAMEPAD_AXIS_MAP,
  createGamepadActionMap,
} from './gamepad.mjs';

export {
  createGameAudioManager,
} from './audio.mjs';

export {
  DETERMINISTIC_RNG_ALGORITHM,
  createDeterministicRng,
} from './random.mjs';

export {
  copyText,
  shareGameLink,
  toggleFullscreen,
  vibrateGame,
  createWakeLockController,
} from './experience.mjs';

export {
  createStateMachine,
} from './state-machine.mjs';

export {
  GAME_LIFECYCLE_STATES,
  createGameLifecycle,
} from './lifecycle.mjs';

export {
  LoadingTaskError,
  runLoadTasks,
  loadingResultsToObject,
} from './loading.mjs';

export {
  validationIssue,
  safeParseJson,
  validateObjectShape,
  field,
} from './validation.mjs';

export const DTF_GAME_PLATFORM_VERSION = '2.2.0';
