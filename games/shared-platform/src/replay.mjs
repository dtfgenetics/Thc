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

function jsonClone(value) {
  return value == null ? value : JSON.parse(JSON.stringify(value));
}

function inspectForForbiddenKeys(value, path = '$', findings = []) {
  if (!value || typeof value !== 'object') return findings;
  if (Array.isArray(value)) {
    value.forEach((entry, index) => inspectForForbiddenKeys(entry, `${path}[${index}]`, findings));
    return findings;
  }
  for (const [key, entry] of Object.entries(value)) {
    const childPath = `${path}.${key}`;
    if (isSensitiveKey(key)) findings.push(childPath);
    inspectForForbiddenKeys(entry, childPath, findings);
  }
  return findings;
}

export function sanitizeDebugValue(value) {
  const cloned = jsonClone(value);
  const findings = inspectForForbiddenKeys(cloned);
  if (findings.length) {
    throw new Error(`debug export contains forbidden/private fields: ${findings.join(', ')}`);
  }
  return cloned;
}

export function validateReplayBundle(bundle, { expectedGameId = null } = {}) {
  const errors = [];
  if (!bundle || typeof bundle !== 'object') errors.push('bundle must be an object');
  if (!bundle?.gameId || typeof bundle.gameId !== 'string') errors.push('gameId is required');
  if (expectedGameId && bundle?.gameId !== expectedGameId) errors.push(`gameId ${bundle?.gameId} does not match ${expectedGameId}`);
  if (!bundle?.releaseVersion || typeof bundle.releaseVersion !== 'string') errors.push('releaseVersion is required');
  if (!Array.isArray(bundle?.actions)) errors.push('actions must be an array');
  if (bundle?.schemaVersion !== 1) errors.push(`unsupported schemaVersion ${bundle?.schemaVersion}`);
  if (bundle?.actions?.some((action) => !action || typeof action.type !== 'string' || !Number.isFinite(action.atMs))) {
    errors.push('every action requires string type and numeric atMs');
  }
  try {
    sanitizeDebugValue(bundle);
  } catch (error) {
    errors.push(error.message);
  }
  return { valid: errors.length === 0, errors };
}

export function createReplayRecorder({
  gameId,
  releaseVersion,
  seedOrCode = null,
  saveVersion = null,
  maxActions = 1000,
  now = () => Date.now(),
  client = {},
} = {}) {
  if (!gameId || typeof gameId !== 'string') throw new Error('gameId is required');
  if (!releaseVersion || typeof releaseVersion !== 'string') throw new Error('releaseVersion is required');
  if (!Number.isInteger(maxActions) || maxActions < 1 || maxActions > 5000) throw new Error('maxActions must be an integer between 1 and 5000');

  const startedAt = now();
  const actions = [];
  let finalResult = null;
  let finalState = null;

  function record(type, payload = null) {
    if (!type || typeof type !== 'string') throw new Error('action type is required');
    const event = {
      index: actions.length,
      atMs: Math.max(0, now() - startedAt),
      type,
      payload: sanitizeDebugValue(payload),
    };
    actions.push(event);
    if (actions.length > maxActions) actions.shift();
    return event;
  }

  function setResult(result) {
    finalResult = sanitizeDebugValue(result);
    return finalResult;
  }

  function setStateSnapshot(state) {
    finalState = sanitizeDebugValue(state);
    return finalState;
  }

  function exportBundle(extra = {}) {
    const bundle = {
      schemaVersion: 1,
      gameId,
      releaseVersion,
      seedOrCode: seedOrCode ?? null,
      saveVersion: saveVersion ?? null,
      capturedAt: new Date(now()).toISOString(),
      durationMs: Math.max(0, now() - startedAt),
      client: sanitizeDebugValue(client),
      actions: actions.map((action, index) => ({ ...action, index })),
      result: finalResult,
      state: finalState,
      ...sanitizeDebugValue(extra),
    };
    const validation = validateReplayBundle(bundle, { expectedGameId: gameId });
    if (!validation.valid) throw new Error(`invalid replay bundle: ${validation.errors.join('; ')}`);
    return bundle;
  }

  return {
    record,
    setResult,
    setStateSnapshot,
    exportBundle,
    getActions: () => actions.map((action) => jsonClone(action)),
    clear: () => { actions.length = 0; finalResult = null; finalState = null; },
  };
}

export function serializeReplayBundle(bundle, space = 2) {
  const validation = validateReplayBundle(bundle);
  if (!validation.valid) throw new Error(`invalid replay bundle: ${validation.errors.join('; ')}`);
  return `${JSON.stringify(bundle, null, space)}\n`;
}

export function parseReplayBundle(text, options = {}) {
  const bundle = JSON.parse(text);
  const validation = validateReplayBundle(bundle, options);
  if (!validation.valid) throw new Error(`invalid replay bundle: ${validation.errors.join('; ')}`);
  return bundle;
}
