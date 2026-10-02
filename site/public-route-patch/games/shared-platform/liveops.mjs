const DEFAULT_STATE = Object.freeze({
  enabled: true,
  maintenance: false,
  multiplayerEnabled: true,
  message: '',
  retryAfterSeconds: null,
});

export function normalizeGameLiveOpsState(value = {}) {
  const retry = value.retryAfterSeconds == null ? null : Number(value.retryAfterSeconds);
  return {
    enabled: value.enabled !== false,
    maintenance: value.maintenance === true,
    multiplayerEnabled: value.multiplayerEnabled !== false,
    message: typeof value.message === 'string' ? value.message.slice(0, 240) : '',
    retryAfterSeconds: Number.isFinite(retry) && retry >= 0 ? Math.floor(retry) : null,
  };
}

export function resolveGameAvailability(value = {}) {
  const state = normalizeGameLiveOpsState(value);
  if (!state.enabled) return { available: false, mode: 'disabled', state };
  if (state.maintenance) return { available: false, mode: 'maintenance', state };
  return { available: true, mode: 'normal', state };
}

export function resolveMultiplayerAvailability(value = {}) {
  const base = resolveGameAvailability(value);
  if (!base.available) return base;
  if (!base.state.multiplayerEnabled) return { available: false, mode: 'multiplayer-disabled', state: base.state };
  return base;
}

export function createLiveOpsController({
  initial = DEFAULT_STATE,
  onChange = null,
} = {}) {
  let current = normalizeGameLiveOpsState(initial);

  function update(next = {}) {
    current = normalizeGameLiveOpsState({ ...current, ...next });
    onChange?.({ ...current });
    return { ...current };
  }

  return {
    get: () => ({ ...current }),
    update,
    gameAvailability: () => resolveGameAvailability(current),
    multiplayerAvailability: () => resolveMultiplayerAvailability(current),
  };
}
