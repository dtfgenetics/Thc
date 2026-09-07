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
  createGameAudioManager,
} from './audio.mjs';

export const DTF_GAME_PLATFORM_VERSION = '1.1.0';
