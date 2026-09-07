export const SETTINGS_VERSION = 1;

export const DEFAULT_GAME_SETTINGS = Object.freeze({
  masterVolume: 1,
  musicVolume: 0.8,
  sfxVolume: 0.9,
  voiceVolume: 1,
  muted: false,
  reducedMotion: 'system',
  highContrast: 'system',
  uiScale: 1,
  haptics: true,
});

const clamp01 = (value, fallback) => {
  const numeric = Number(value);
  return Number.isFinite(numeric) ? Math.min(1, Math.max(0, numeric)) : fallback;
};

const clampScale = (value) => {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return DEFAULT_GAME_SETTINGS.uiScale;
  return Math.min(1.35, Math.max(0.9, numeric));
};

const triState = (value, fallback) => ['system', 'on', 'off'].includes(value) ? value : fallback;

export function normalizeGameSettings(input = {}) {
  return {
    masterVolume: clamp01(input.masterVolume, DEFAULT_GAME_SETTINGS.masterVolume),
    musicVolume: clamp01(input.musicVolume, DEFAULT_GAME_SETTINGS.musicVolume),
    sfxVolume: clamp01(input.sfxVolume, DEFAULT_GAME_SETTINGS.sfxVolume),
    voiceVolume: clamp01(input.voiceVolume, DEFAULT_GAME_SETTINGS.voiceVolume),
    muted: Boolean(input.muted),
    reducedMotion: triState(input.reducedMotion, DEFAULT_GAME_SETTINGS.reducedMotion),
    highContrast: triState(input.highContrast, DEFAULT_GAME_SETTINGS.highContrast),
    uiScale: clampScale(input.uiScale),
    haptics: input.haptics !== false,
  };
}

function safeStorage(storage) {
  return storage && typeof storage.getItem === 'function' && typeof storage.setItem === 'function'
    ? storage
    : null;
}

function storageKey(gameId, namespace) {
  if (!gameId || typeof gameId !== 'string') throw new Error('gameId is required');
  return `${namespace}.${gameId}.v${SETTINGS_VERSION}`;
}

export function resolveAccessibilityPreferences(settings, matchMedia = globalThis.matchMedia) {
  const normalized = normalizeGameSettings(settings);
  const systemReduce = typeof matchMedia === 'function'
    ? Boolean(matchMedia('(prefers-reduced-motion: reduce)')?.matches)
    : false;
  const systemContrast = typeof matchMedia === 'function'
    ? Boolean(matchMedia('(forced-colors: active)')?.matches || matchMedia('(prefers-contrast: more)')?.matches)
    : false;

  return {
    reducedMotion: normalized.reducedMotion === 'system' ? systemReduce : normalized.reducedMotion === 'on',
    highContrast: normalized.highContrast === 'system' ? systemContrast : normalized.highContrast === 'on',
    uiScale: normalized.uiScale,
  };
}

export function applyAccessibilityPreferences(target, settings, matchMedia = globalThis.matchMedia) {
  if (!target?.dataset || !target?.style) return resolveAccessibilityPreferences(settings, matchMedia);
  const resolved = resolveAccessibilityPreferences(settings, matchMedia);
  target.dataset.dtfReducedMotion = resolved.reducedMotion ? 'true' : 'false';
  target.dataset.dtfHighContrast = resolved.highContrast ? 'true' : 'false';
  target.style.setProperty('--dtf-ui-scale', String(resolved.uiScale));
  return resolved;
}

export function createGameSettingsStore({
  gameId,
  storage = globalThis.localStorage,
  namespace = 'dtf.game.settings',
  defaults = DEFAULT_GAME_SETTINGS,
} = {}) {
  const backing = safeStorage(storage);
  const key = storageKey(gameId, namespace);
  const listeners = new Set();
  let current = normalizeGameSettings(defaults);

  function load() {
    if (!backing) return current;
    try {
      const raw = backing.getItem(key);
      if (!raw) return current;
      const parsed = JSON.parse(raw);
      current = normalizeGameSettings({ ...defaults, ...(parsed?.settings ?? parsed) });
    } catch {
      current = normalizeGameSettings(defaults);
    }
    return current;
  }

  function persist() {
    if (!backing) return false;
    try {
      backing.setItem(key, JSON.stringify({ version: SETTINGS_VERSION, settings: current }));
      return true;
    } catch {
      return false;
    }
  }

  function emit() {
    for (const listener of listeners) listener(current);
  }

  function update(patch) {
    current = normalizeGameSettings({ ...current, ...(typeof patch === 'function' ? patch(current) : patch) });
    persist();
    emit();
    return current;
  }

  function reset() {
    current = normalizeGameSettings(defaults);
    if (backing) {
      try { backing.removeItem(key); } catch {}
    }
    emit();
    return current;
  }

  function subscribe(listener) {
    if (typeof listener !== 'function') throw new Error('settings listener must be a function');
    listeners.add(listener);
    return () => listeners.delete(listener);
  }

  load();

  return {
    key,
    get: () => current,
    load,
    update,
    reset,
    subscribe,
    resolveAccessibility: (matchMedia) => resolveAccessibilityPreferences(current, matchMedia),
    applyAccessibility: (target, matchMedia) => applyAccessibilityPreferences(target, current, matchMedia),
  };
}

export function effectiveAudioGain(settings, category = 'sfx') {
  const normalized = normalizeGameSettings(settings);
  if (normalized.muted) return 0;
  const categoryGain = category === 'music'
    ? normalized.musicVolume
    : category === 'voice'
      ? normalized.voiceVolume
      : normalized.sfxVolume;
  return normalized.masterVolume * categoryGain;
}
