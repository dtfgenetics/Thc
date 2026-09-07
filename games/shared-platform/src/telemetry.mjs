const EVENT_NAME = /^[a-z][a-z0-9_]{1,63}$/;

const SENSITIVE_KEYS = new Set([
  'email', 'emailaddress', 'playeremail',
  'phone', 'phonenumber', 'playerphone',
  'name', 'fullname', 'playername', 'displayname', 'username',
  'address', 'streetaddress', 'ipaddress',
  'password', 'passwd', 'secret', 'clientsecret',
  'token', 'accesstoken', 'refreshtoken', 'authorization',
  'cookie', 'sessionid', 'sessiontoken',
  'chat', 'chatmessage', 'message', 'privatemessage',
  'roomcode', 'roomsecret', 'invite', 'invitecode', 'invitekey'
]);

function normalizedKey(key) {
  return String(key).replace(/[^a-z0-9]/gi, '').toLowerCase();
}

function isSensitiveKey(key) {
  const normalized = normalizedKey(key);
  if (SENSITIVE_KEYS.has(normalized)) return true;
  return normalized.endsWith('email')
    || normalized.endsWith('phonenumber')
    || normalized.endsWith('password')
    || normalized.endsWith('secret')
    || normalized.endsWith('token')
    || normalized.endsWith('authorization')
    || normalized.endsWith('cookie')
    || normalized.endsWith('sessionid')
    || normalized.endsWith('roomcode')
    || normalized.endsWith('invitecode')
    || normalized.endsWith('invitekey');
}

function clone(value) {
  return value == null ? value : JSON.parse(JSON.stringify(value));
}

function validatePayload(value, path = '$', errors = []) {
  if (value == null) return errors;
  if (Array.isArray(value)) {
    value.forEach((entry, index) => validatePayload(entry, `${path}[${index}]`, errors));
    return errors;
  }
  if (typeof value !== 'object') return errors;
  for (const [key, entry] of Object.entries(value)) {
    if (isSensitiveKey(key)) errors.push(`${path}.${key}`);
    validatePayload(entry, `${path}.${key}`, errors);
  }
  return errors;
}

export function validateTelemetryEvent(event) {
  const errors = [];
  if (!event || typeof event !== 'object') errors.push('event must be an object');
  if (!EVENT_NAME.test(event?.name ?? '')) errors.push('name must be lowercase snake_case');
  if (!event?.gameId || typeof event.gameId !== 'string') errors.push('gameId is required');
  if (!Number.isFinite(event?.atMs) || event.atMs < 0) errors.push('atMs must be a non-negative number');
  const privateKeys = validatePayload(event?.payload);
  if (privateKeys.length) errors.push(`payload includes disallowed private fields: ${privateKeys.join(', ')}`);
  return { valid: errors.length === 0, errors };
}

export function createTelemetryBuffer({
  gameId,
  releaseVersion = 'unknown',
  enabled = false,
  maxEvents = 250,
  now = () => Date.now(),
} = {}) {
  if (!gameId || typeof gameId !== 'string') throw new Error('gameId is required');
  if (!Number.isInteger(maxEvents) || maxEvents < 1 || maxEvents > 2000) throw new Error('maxEvents must be between 1 and 2000');

  const startedAt = now();
  const events = [];
  let active = Boolean(enabled);

  function track(name, payload = {}) {
    if (!active) return null;
    const event = {
      schemaVersion: 1,
      gameId,
      releaseVersion,
      name,
      atMs: Math.max(0, now() - startedAt),
      payload: clone(payload),
    };
    const validation = validateTelemetryEvent(event);
    if (!validation.valid) throw new Error(`invalid telemetry event: ${validation.errors.join('; ')}`);
    events.push(event);
    if (events.length > maxEvents) events.shift();
    return clone(event);
  }

  async function flush(consumer) {
    if (typeof consumer !== 'function') throw new Error('telemetry consumer must be a function');
    const batch = events.map(clone);
    if (!batch.length) return { sent: 0 };
    await consumer(batch);
    events.splice(0, batch.length);
    return { sent: batch.length };
  }

  return {
    track,
    flush,
    setEnabled(value) { active = Boolean(value); },
    isEnabled: () => active,
    peek: () => events.map(clone),
    clear: () => { events.length = 0; },
  };
}

export const RECOMMENDED_TELEMETRY_EVENTS = Object.freeze([
  'game_start',
  'tutorial_complete',
  'game_complete',
  'game_abandon',
  'restart',
  'failure_reason',
  'level_reached',
  'round_reached',
  'difficulty_selected',
  'room_create_failed',
  'room_join_failed',
  'room_reconnect_failed',
]);
