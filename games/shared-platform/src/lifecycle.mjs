const LIFECYCLE_STATES = Object.freeze([
  'booting',
  'loading',
  'ready',
  'playing',
  'paused',
  'completed',
  'failed',
]);

const TERMINAL_STATES = new Set(['completed', 'failed']);

const ALLOWED_TRANSITIONS = Object.freeze({
  booting: new Set(['loading', 'failed']),
  loading: new Set(['ready', 'failed']),
  ready: new Set(['playing', 'failed']),
  playing: new Set(['paused', 'completed', 'failed']),
  paused: new Set(['playing', 'completed', 'failed']),
  completed: new Set([]),
  failed: new Set([]),
});

function clone(value) {
  return value == null ? value : JSON.parse(JSON.stringify(value));
}

function assertMetadataSafe(metadata) {
  if (metadata == null) return;
  if (typeof metadata !== 'object' || Array.isArray(metadata)) {
    throw new Error('lifecycle metadata must be an object');
  }
  const forbidden = /(email|phone|password|secret|token|cookie|session|player.?name|display.?name|room.?code|invite)/i;
  const stack = [[metadata, '$']];
  while (stack.length) {
    const [value, path] = stack.pop();
    for (const [key, entry] of Object.entries(value)) {
      const nextPath = `${path}.${key}`;
      if (forbidden.test(key)) throw new Error(`lifecycle metadata contains private field: ${nextPath}`);
      if (entry && typeof entry === 'object') stack.push([entry, nextPath]);
    }
  }
}

export function createGameLifecycle({
  gameId,
  releaseVersion = 'unknown',
  now = () => Date.now(),
  telemetry = null,
  onTransition = null,
} = {}) {
  if (!gameId || typeof gameId !== 'string') throw new Error('gameId is required');
  const startedAt = now();
  const history = [];
  let current = 'booting';

  function record(from, to, metadata = {}) {
    assertMetadataSafe(metadata);
    const event = {
      schemaVersion: 1,
      gameId,
      releaseVersion,
      from,
      to,
      atMs: Math.max(0, now() - startedAt),
      metadata: clone(metadata),
    };
    history.push(event);
    telemetry?.track?.('lifecycle_transition', {
      from,
      to,
      ...clone(metadata),
    });
    onTransition?.(clone(event));
    return clone(event);
  }

  record(null, current, { initial: true });

  function transition(next, metadata = {}) {
    if (!LIFECYCLE_STATES.includes(next)) throw new Error(`unknown lifecycle state: ${next}`);
    if (next === current) return null;
    if (!ALLOWED_TRANSITIONS[current].has(next)) {
      throw new Error(`invalid lifecycle transition: ${current} -> ${next}`);
    }
    const from = current;
    current = next;
    return record(from, next, metadata);
  }

  const api = {
    state: () => current,
    history: () => history.map(clone),
    is: (state) => current === state,
    isTerminal: () => TERMINAL_STATES.has(current),
    transition,
    loading: (metadata) => transition('loading', metadata),
    ready: (metadata) => transition('ready', metadata),
    play: (metadata) => transition('playing', metadata),
    pause: (metadata) => transition('paused', metadata),
    complete: (metadata) => transition('completed', metadata),
    fail: (metadata) => transition('failed', metadata),
  };

  return api;
}

export const GAME_LIFECYCLE_STATES = LIFECYCLE_STATES;
