function safeAttributes(attributes = {}) {
  if (!attributes || typeof attributes !== 'object' || Array.isArray(attributes)) return {};
  const blocked = /(email|phone|password|secret|token|cookie|authorization|message|chat|invite|room.?code|display.?name|player.?name)/i;
  const out = {};
  for (const [key, value] of Object.entries(attributes)) {
    if (blocked.test(key)) continue;
    if (['string','number','boolean'].includes(typeof value) || value == null) out[key] = value;
  }
  return out;
}

export function createGameObservability({
  gameId,
  releaseVersion = 'unknown',
  sink = null,
  now = () => Date.now(),
} = {}) {
  if (!gameId || typeof gameId !== 'string') throw new Error('gameId is required');
  const buffer = [];

  function emit(kind, name, value = null, attributes = {}) {
    if (!name || typeof name !== 'string') throw new Error('metric/event name is required');
    const record = {
      schemaVersion: 1,
      gameId,
      releaseVersion,
      kind,
      name,
      value,
      at: now(),
      attributes: safeAttributes(attributes),
    };
    buffer.push(record);
    sink?.emit?.({ ...record });
    return { ...record };
  }

  return {
    counter(name, amount = 1, attributes = {}) {
      const value = Number(amount);
      if (!Number.isFinite(value)) throw new Error('counter amount must be finite');
      return emit('counter', name, value, attributes);
    },
    gauge(name, value, attributes = {}) {
      const numeric = Number(value);
      if (!Number.isFinite(numeric)) throw new Error('gauge value must be finite');
      return emit('gauge', name, numeric, attributes);
    },
    timing(name, milliseconds, attributes = {}) {
      const numeric = Number(milliseconds);
      if (!Number.isFinite(numeric) || numeric < 0) throw new Error('timing must be a non-negative finite number');
      return emit('timing', name, numeric, attributes);
    },
    event(name, attributes = {}) {
      return emit('event', name, null, attributes);
    },
    error(name, error, attributes = {}) {
      return emit('error', name, null, {
        ...attributes,
        errorType: error?.name || 'Error',
        errorCode: error?.code || null,
      });
    },
    records() {
      return buffer.map((entry) => ({ ...entry, attributes: { ...entry.attributes } }));
    },
    clear() {
      buffer.length = 0;
    },
  };
}

export const RECOMMENDED_OPERATIONAL_METRICS = Object.freeze([
  'rooms_active',
  'players_connected',
  'room_create_failed',
  'room_join_failed',
  'reconnect_attempt',
  'reconnect_success',
  'reconnect_failed',
  'network_latency_ms',
  'server_tick_ms',
  'database_latency_ms',
  'request_duration_ms',
  'runtime_error',
]);
